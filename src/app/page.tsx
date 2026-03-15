/**
 * page.tsx — Home page (Server Component)
 *
 * Reads `searchParams.city` from Next.js App Router page props.
 * Computes national summary (worst / median / best PM2.5 city) from getAllStations().
 * When city=krakow, also loads Kraków station data and passes it to PageShell.
 *
 * This component stays a Server Component so that:
 *  - searchParams are available synchronously at render time
 *  - Data fetching happens on the server (no loading flicker for local JSON)
 *  - PageShell (a Client Component) owns all interactive state (lang, etc.)
 */

import PageShell from "@/app/components/PageShell";
import {
  getAllStations,
  getKrakowStations,
  getPrimaryKrakowStation,
} from "@/lib/localData";
import { giosLabelToKey, getLevelConfig } from "@/lib/aqi-config";
import type { StationSummary } from "@/lib/types";

// ─── National summary helpers ────────────────────────────────────────────────

/** Numeric score for a station — higher is worse. */
function stationScore(s: StationSummary): number {
  const key = giosLabelToKey(s.aqi.level_name);
  const cfg = getLevelConfig(key);
  return cfg.score; // 0–5
}

/** Raw PM2.5 value stored on a station record, or 0 as fallback. */
function stationPm25(s: StationSummary): number {
  // The station summary doesn't carry a standalone pm25 field, so we infer
  // from the AQI score's midpoint via getLevelConfig to get a representative value.
  // Fallback: use score * 10 as a rough approximation when no finer data is available.
  const key = giosLabelToKey(s.aqi.level_name);
  if (key === "no_data") return 0;
  const cfg = getLevelConfig(key);
  if ("pm25_min" in cfg) {
    // Return the midpoint of the level's PM2.5 range (Infinity → use pm25_min + 25)
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
  // Only include stations that have actual data
  const withData = stations.filter((s) => giosLabelToKey(s.aqi.level_name) !== "no_data");
  if (withData.length === 0) return null;

  // Sort by score descending (worst first), then by city name for stability
  const sorted = [...withData].sort((a, b) => {
    const scoreDiff = stationScore(b) - stationScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.city.localeCompare(b.city, "pl");
  });

  const worst  = sorted[0];
  const best   = sorted[sorted.length - 1];
  const medIdx = Math.floor(sorted.length / 2);
  const median = sorted[medIdx];

  return {
    worst:  { city: worst.city,  pm25: stationPm25(worst) },
    median: { city: median.city, pm25: stationPm25(median) },
    best:   { city: best.city,   pm25: stationPm25(best) },
  };
}

// ─── Page component ──────────────────────────────────────────────────────────

// Next.js 15+ passes searchParams as a Promise; accept both forms for safety.
type SearchParams = Promise<{ city?: string }> | { city?: string };

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Resolve searchParams (Next.js 15 requires await; earlier versions pass plain object)
  const params = await Promise.resolve(searchParams);
  const cityParam = typeof params.city === "string" ? params.city : null;

  // ── Data ──
  const allStations = getAllStations();
  const national    = computeNationalSummary(allStations);

  let krakowStations: StationSummary[] = [];
  let primarySummary: StationSummary | null = null;
  let primaryReadings = undefined;

  if (cityParam === "krakow") {
    krakowStations = getKrakowStations();
    const primary  = getPrimaryKrakowStation();
    primarySummary = primary.summary ?? null;
    primaryReadings = primary.readings;
  }

  return (
    <PageShell
      allStations={allStations}
      krakowStations={krakowStations}
      primarySummary={primarySummary}
      primaryReadings={primaryReadings}
      national={national}
      cityParam={cityParam}
    />
  );
}
