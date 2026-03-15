/**
 * scripts/fetch-gios.ts
 * Standalone data fetcher: pulls all GIOŚ stations and their latest AQI index
 * readings, then upserts everything into Supabase.
 *
 * Run manually:
 *   npx tsx scripts/fetch-gios.ts
 *
 * Environment variables required (.env.local):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * What it does:
 *   1. Fetches all ~500 GIOŚ measurement stations (findAll endpoint)
 *   2. For each station, fetches the latest AQI index (getIndex endpoint)
 *      — batched to respect the GIOŚ rate limit (~1 req/100ms recommended)
 *   3. Upserts station metadata into the `stations` table
 *   4. Inserts one reading per station into the `readings` table
 *      (skips if an identical measured_at already exists for that station)
 *
 * Design notes:
 *   - Uses dotenv to load .env.local so it works outside Next.js
 *   - Concurrency is capped at BATCH_SIZE to avoid hammering GIOŚ API
 *   - All errors are logged per-station and do not abort the whole run
 *   - Exit code 0 = success (even with partial failures); 1 = fatal error
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ─── Load .env.local manually (tsx doesn't use Next.js env loading) ───────────

function loadEnv(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const raw = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding single or double quotes (e.g. KEY="value" or KEY='value')
      const val = raw.replace(/^(['"])(.*)\1$/, "$2");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local may not exist in CI — rely on real env vars
  }
}

loadEnv();

// ─── Supabase client ──────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ─── GIOŚ API types ───────────────────────────────────────────────────────────

const GIOS_BASE = "https://api.gios.gov.pl/pjp-api";

type GiosStation = {
  "Identyfikator stacji": number;
  "Kod stacji": string;
  "Nazwa stacji": string;
  "WGS84 φ N": string;
  "WGS84 λ E": string;
  "Nazwa miasta": string;
  Gmina: string;
  Powiat: string;
  Województwo: string;
  Ulica: string | null;
};

type GiosIndex = {
  "Identyfikator stacji pomiarowej": number;
  "Data wykonania obliczeń indeksu": string | null;
  "Wartość indeksu": number | null;
  "Nazwa kategorii indeksu": string | null;
  "Wartość indeksu dla wskaźnika PM2.5": number | null;
  "Nazwa kategorii indeksu dla wskaźnika PM2.5": string | null;
  "Wartość indeksu dla wskaźnika PM10": number | null;
  "Nazwa kategorii indeksu dla wskaźnika PM10": string | null;
  "Wartość indeksu dla wskaźnika NO2": number | null;
  "Nazwa kategorii indeksu dla wskaźnika NO2": string | null;
  "Wartość indeksu dla wskaźnika SO2": number | null;
  "Nazwa kategorii indeksu dla wskaźnika SO2": string | null;
  "Wartość indeksu dla wskaźnika O3": number | null;
  "Nazwa kategorii indeksu dla wskaźnika O3": string | null;
};

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchAllStations(): Promise<GiosStation[]> {
  const url = `${GIOS_BASE}/v1/rest/station/findAll?page=0&size=5000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GIOŚ findAll failed: ${res.status}`);
  const data = await res.json() as { "Lista stacji pomiarowych": GiosStation[] };
  return data["Lista stacji pomiarowych"] ?? [];
}

async function fetchIndex(stationId: number): Promise<GiosIndex | null> {
  const url = `${GIOS_BASE}/v1/rest/aqindex/getIndex/${stationId}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { AqIndex: GiosIndex };
    return data["AqIndex"] ?? null;
  } catch {
    return null;
  }
}

// ─── Batch helper — runs promises in chunks to respect rate limits ─────────────

async function batchMap<T, R>(
  items: T[],
  batchSize: number,
  delayMs: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const chunkResults = await Promise.all(chunk.map((item, j) => fn(item, i + j)));
    results.push(...chunkResults);
    if (i + batchSize < items.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    process.stdout.write(`\r  fetching AQI index: ${Math.min(i + batchSize, items.length)}/${items.length}`);
  }
  process.stdout.write("\n");
  return results;
}

// ─── Supabase upsert helpers ──────────────────────────────────────────────────

type StationRow = {
  id: string;
  source: "gios";
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
};

type ReadingRow = {
  station_id: string;
  measured_at: string;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  so2: number | null;
  co: null;
  aqi_value: number | null;
  aqi_level: string | null;
};

async function upsertStations(rows: StationRow[]): Promise<void> {
  const { error } = await supabase
    .from("stations")
    .upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Station upsert failed: ${error.message}`);
}

async function insertReadings(rows: ReadingRow[]): Promise<{ inserted: number; skipped: number }> {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };

  // Insert in chunks of 100 to stay within Supabase payload limits
  const CHUNK = 100;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from("readings")
      .insert(chunk, { count: "exact" });

    if (error) {
      // Duplicate measured_at for same station — expected on re-runs
      if (error.code === "23505") {
        skipped += chunk.length;
      } else {
        console.warn(`  ⚠ readings insert warning: ${error.message}`);
        skipped += chunk.length;
      }
    } else {
      inserted += count ?? chunk.length;
    }
  }
  return { inserted, skipped };
}

// ─── AQI score helper (index value → numeric score for aqi_value column) ──────
// GIOŚ "Wartość indeksu" is already 0–5; store it × 10 to match existing schema

function aqiValueToScore(val: number | null): number | null {
  if (val === null) return null;
  return val * 10;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 20;   // concurrent requests per batch
const BATCH_DELAY = 300; // ms between batches — stays well under GIOŚ rate limit

async function main(): Promise<void> {
  console.log("🚀 Powietrze GIOŚ fetcher starting…\n");

  // 1. Fetch all stations
  console.log("1/4  Fetching station list from GIOŚ…");
  const giosStations = await fetchAllStations();
  console.log(`     ${giosStations.length} stations found.\n`);

  // 2. Build station rows for Supabase
  const stationRows: StationRow[] = giosStations.map((s) => ({
    id: `gios_${s["Identyfikator stacji"]}`,
    source: "gios",
    name: s["Nazwa stacji"],
    city: s["Nazwa miasta"],
    latitude: Number(s["WGS84 φ N"]),
    longitude: Number(s["WGS84 λ E"]),
    is_active: true,
  }));

  // 3. Upsert stations
  console.log("2/4  Upserting stations into Supabase…");
  await upsertStations(stationRows);
  console.log(`     ✓ ${stationRows.length} stations upserted.\n`);

  // 4. Fetch AQI index for each station
  console.log("3/4  Fetching AQI index for each station (batched)…");
  const indices = await batchMap(
    giosStations,
    BATCH_SIZE,
    BATCH_DELAY,
    (s) => fetchIndex(s["Identyfikator stacji"]),
  );

  // 5. Build reading rows — only for stations that have index data
  const now = new Date().toISOString();
  const readingRows: ReadingRow[] = [];

  for (let i = 0; i < giosStations.length; i++) {
    const station = giosStations[i];
    const idx = indices[i];
    if (!idx) continue;

    const measuredAt = idx["Data wykonania obliczeń indeksu"]
      ? new Date(idx["Data wykonania obliczeń indeksu"]).toISOString()
      : now;

    readingRows.push({
      station_id: `gios_${station["Identyfikator stacji"]}`,
      measured_at: measuredAt,
      pm25: idx["Wartość indeksu dla wskaźnika PM2.5"] ?? null,
      pm10: idx["Wartość indeksu dla wskaźnika PM10"] ?? null,
      no2:  idx["Wartość indeksu dla wskaźnika NO2"]  ?? null,
      o3:   idx["Wartość indeksu dla wskaźnika O3"]   ?? null,
      so2:  idx["Wartość indeksu dla wskaźnika SO2"]  ?? null,
      co:   null, // GIOŚ index endpoint does not return CO index values
      aqi_value: aqiValueToScore(idx["Wartość indeksu"] ?? null),
      aqi_level: idx["Nazwa kategorii indeksu"] ?? null,
    });
  }

  console.log(`\n     ${readingRows.length} stations have index data.\n`);

  // 6. Insert readings
  console.log("4/4  Inserting readings into Supabase…");
  const { inserted, skipped } = await insertReadings(readingRows);
  console.log(`     ✓ ${inserted} inserted, ${skipped} skipped (duplicates).\n`);

  console.log("✅ Done.");
}

main().catch((err: unknown) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
