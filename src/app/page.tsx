/**
 * page.tsx — Home page (Server Component)
 *
 * Reads `searchParams.city` (a slug, e.g. "krakow", "warszawa") from Next.js
 * App Router page props. Computes national summary and city-specific data,
 * then passes everything to PageShell (Client Component).
 *
 * DATA SOURCE PRIORITY (first match wins):
 *   1. USE_LOCAL_DB=true (or data/local.db exists) → localDb.ts  (SQLite)
 *   2. SUPABASE_URL is set                         → supabaseData.ts
 *   3. Fallback                                    → localData.ts (JSON snapshots)
 *
 * All three sources return the same StationSummary shape — components are unaware
 * of which source is active and need no changes when switching.
 */

import PageShell from "@/app/components/PageShell";
import { giosLabelToKey, getLevelConfig } from "@/lib/aqi-config";
import type { StationSummary } from "@/lib/types";
import fs from "fs";
import path from "path";

// ─── Data source toggle ────────────────────────────────────────────────────────

// Priority 1: local SQLite DB (set USE_LOCAL_DB=true in .env.local, or just
// have data/local.db present on disk — detected automatically)
const LOCAL_DB_PATH = path.resolve(process.cwd(), "data/local.db");
const USE_LOCAL_DB =
  process.env.USE_LOCAL_DB === "true" || fs.existsSync(LOCAL_DB_PATH);

// Priority 2: Supabase (only if local.db is not present)
const USE_SUPABASE =
  !USE_LOCAL_DB &&
  Boolean(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL);

import * as localDb from "@/lib/localDb";
import * as localData from "@/lib/localData";
import * as supabaseData from "@/lib/supabaseData";

function getDataSource() {
  if (USE_LOCAL_DB) return localDb;
  if (USE_SUPABASE) return supabaseData;
  return localData;
}

async function getAllStations() {
  return getDataSource().getAllStations();
}
async function getStationsByCity(slug: string) {
  return getDataSource().getStationsByCity(slug);
}
async function slugToCity(slug: string) {
  return getDataSource().slugToCity(slug);
}
async function getPrimaryStation(slug: string) {
  const src = getDataSource();
  if ("getPrimaryStation" in src) {
    return (src as typeof localDb).getPrimaryStation(slug);
  }
  // supabaseData & localData use getPrimaryKrakowStation as a fallback
  return (src as typeof localData).getPrimaryKrakowStation();
}

// ─── National summary (computed from station list) ────────────────────────────

function stationScore(s: StationSummary): number {
  return getLevelConfig(giosLabelToKey(s.aqi.level_name)).score;
}

function stationPm25(s: StationSummary): number {
  const key = giosLabelToKey(s.aqi.level_name);
  if (key === "no_data") return 0;
  const cfg = getLevelConfig(key);
  if ("pm25_min" in cfg) {
    const max = cfg.pm25_max === Infinity ? cfg.pm25_min + 25 : cfg.pm25_max;
    return Math.round((cfg.pm25_min + max) / 2);
  }
  return cfg.score * 10;
}

type NationalSummary = {
  worst:  { city: string; pm25: number };
  median: { city: string; pm25: number };
  best:   { city: string; pm25: number };
};

function computeNationalSummary(stations: StationSummary[]): NationalSummary | null {
  const withData = stations.filter(
    (s) => giosLabelToKey(s.aqi.level_name) !== "no_data"
  );
  if (withData.length === 0) return null;

  const sorted = [...withData].sort((a, b) => {
    const diff = stationScore(b) - stationScore(a);
    return diff !== 0 ? diff : a.city.localeCompare(b.city, "pl");
  });

  const worst  = sorted[0];
  const best   = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];

  return {
    worst:  { city: worst.city,  pm25: stationPm25(worst) },
    median: { city: median.city, pm25: stationPm25(median) },
    best:   { city: best.city,   pm25: stationPm25(best) },
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type SearchParams = Promise<{ city?: string }> | { city?: string };

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params    = await Promise.resolve(searchParams);
  const cityParam = typeof params.city === "string" ? params.city : null;

  const allStations = await getAllStations();
  const national    = computeNationalSummary(allStations);

  const cityStations = cityParam ? await getStationsByCity(cityParam) : [];
  const cityName     = cityParam ? await slugToCity(cityParam) : null;

  let primarySummary  = null;
  let primaryReadings = undefined;
  if (cityParam && cityStations.length > 0) {
    const primary   = await getPrimaryStation(cityParam);
    primarySummary  = primary.summary ?? null;
    primaryReadings = primary.readings;
  }

  return (
    <PageShell
      allStations={allStations}
      cityStations={cityStations}
      primarySummary={primarySummary}
      primaryReadings={primaryReadings}
      national={national}
      cityParam={cityParam}
      cityName={cityName}
    />
  );
}
