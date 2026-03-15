/**
 * api/cron/fetch-gios/route.ts
 * Vercel Cron Job endpoint — runs the GIOŚ data fetcher on a schedule.
 * Configured in vercel.json to run every hour.
 *
 * Security: Vercel automatically sends a CRON_SECRET header on cron invocations.
 * We verify it here to prevent unauthorised external triggers.
 *
 * Does NOT import from scripts/fetch-gios.ts (that file uses Node.js fs/path
 * which are not available in the Edge runtime). All fetch logic is inline here,
 * using the same Supabase client as the rest of the app.
 */

import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorised(request: Request): boolean {
  // In development, skip auth check
  if (process.env.NODE_ENV !== "production") return true;

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // If no secret is configured, block all requests in production
  if (!cronSecret) return false;

  return authHeader === `Bearer ${cronSecret}`;
}

// ─── GIOŚ types ───────────────────────────────────────────────────────────────

type GiosStation = {
  "Identyfikator stacji": number;
  "Nazwa stacji": string;
  "WGS84 φ N": string;
  "WGS84 λ E": string;
  "Nazwa miasta": string;
  Ulica: string | null;
};

type GiosIndex = {
  "Identyfikator stacji pomiarowej": number;
  "Data wykonania obliczeń indeksu": string | null;
  "Wartość indeksu": number | null;
  "Nazwa kategorii indeksu": string | null;
  "Wartość indeksu dla wskaźnika PM2.5": number | null;
  "Wartość indeksu dla wskaźnika PM10": number | null;
  "Wartość indeksu dla wskaźnika NO2": number | null;
  "Wartość indeksu dla wskaźnika O3": number | null;
  "Wartość indeksu dla wskaźnika SO2": number | null;
};

// ─── Fetch helpers ────────────────────────────────────────────────────────────

const GIOS_BASE = process.env.GIOS_API_BASE_URL ?? "https://api.gios.gov.pl/pjp-api";
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 300;

async function fetchAllGiosStations(): Promise<GiosStation[]> {
  const res = await fetch(`${GIOS_BASE}/v1/rest/station/findAll?page=0&size=5000`);
  if (!res.ok) throw new Error(`GIOŚ findAll failed: ${res.status}`);
  const data = await res.json() as { "Lista stacji pomiarowych": GiosStation[] };
  return data["Lista stacji pomiarowych"] ?? [];
}

async function fetchIndex(stationId: number): Promise<GiosIndex | null> {
  try {
    const res = await fetch(`${GIOS_BASE}/v1/rest/aqindex/getIndex/${stationId}`);
    if (!res.ok) return null;
    const data = await res.json() as { AqIndex: GiosIndex };
    return data["AqIndex"] ?? null;
  } catch {
    return null;
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const db = getServiceClient();

    // 1. Fetch all stations
    const stations = await fetchAllGiosStations();

    // 2. Upsert station metadata
    const stationRows = stations.map((s) => ({
      id: `gios_${s["Identyfikator stacji"]}`,
      source: "gios" as const,
      name: s["Nazwa stacji"],
      city: s["Nazwa miasta"],
      latitude: Number(s["WGS84 φ N"]),
      longitude: Number(s["WGS84 λ E"]),
      is_active: true,
    }));

    const { error: upsertErr } = await db
      .from("stations")
      .upsert(stationRows, { onConflict: "id" });

    if (upsertErr) throw new Error(`Station upsert failed: ${upsertErr.message}`);

    // 3. Fetch AQI index in batches
    const indices: (GiosIndex | null)[] = [];
    for (let i = 0; i < stations.length; i += BATCH_SIZE) {
      const chunk = stations.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        chunk.map((s) => fetchIndex(s["Identyfikator stacji"]))
      );
      indices.push(...results);
      if (i + BATCH_SIZE < stations.length) await delay(BATCH_DELAY_MS);
    }

    // 4. Build and insert reading rows
    const now = new Date().toISOString();
    const readingRows = stations
      .map((s, i) => {
        const idx = indices[i];
        if (!idx) return null;
        const measuredAt = idx["Data wykonania obliczeń indeksu"]
          ? new Date(idx["Data wykonania obliczeń indeksu"]).toISOString()
          : now;
        return {
          station_id: `gios_${s["Identyfikator stacji"]}`,
          measured_at: measuredAt,
          pm25:      idx["Wartość indeksu dla wskaźnika PM2.5"] ?? null,
          pm10:      idx["Wartość indeksu dla wskaźnika PM10"]  ?? null,
          no2:       idx["Wartość indeksu dla wskaźnika NO2"]   ?? null,
          o3:        idx["Wartość indeksu dla wskaźnika O3"]    ?? null,
          so2:       idx["Wartość indeksu dla wskaźnika SO2"]   ?? null,
          co:        null,
          aqi_value: idx["Wartość indeksu"] !== null ? (idx["Wartość indeksu"] ?? 0) * 10 : null,
          aqi_level: idx["Nazwa kategorii indeksu"] ?? null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // Insert in chunks of 100
    let inserted = 0;
    let skipped = 0;
    for (let i = 0; i < readingRows.length; i += 100) {
      const chunk = readingRows.slice(i, i + 100);
      const { error, count } = await db
        .from("readings")
        .insert(chunk, { count: "exact" });
      if (error) {
        skipped += chunk.length;
      } else {
        inserted += count ?? chunk.length;
      }
    }

    const durationMs = Date.now() - startedAt;

    return NextResponse.json({
      ok: true,
      stations: stationRows.length,
      readings: { inserted, skipped },
      durationMs,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
