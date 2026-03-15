/**
 * page.tsx — Home page (Server Component)
 *
 * Reads `searchParams.city` (a slug, e.g. "krakow", "warszawa") from Next.js
 * App Router page props. Computes national summary and city-specific data,
 * then passes everything to PageShell (Client Component).
 *
 * Supports any city in stations-summary.json, not just Kraków.
 * Kraków additionally gets full sensor readings from krakow-readings.json.
 */

import PageShell from "@/app/components/PageShell";
import {
  getAllStations,
  getStationsByCity,
  slugToCity,
  getPrimaryKrakowStation,
} from "@/lib/localData";
import { giosLabelToKey, getLevelConfig } from "@/lib/aqi-config";
import type { StationSummary } from "@/lib/types";

// ─── National summary ─────────────────────────────────────────────────────────

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
  const withData = stations.filter((s) => giosLabelToKey(s.aqi.level_name) !== "no_data");
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type SearchParams = Promise<{ city?: string }> | { city?: string };

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params    = await Promise.resolve(searchParams);
  const cityParam = typeof params.city === "string" ? params.city : null;

  const allStations = getAllStations();
  const national    = computeNationalSummary(allStations);

  // City-specific data (empty/null for no selection)
  const cityStations   = cityParam ? getStationsByCity(cityParam) : [];
  const cityName       = cityParam ? slugToCity(cityParam) : null;

  // Kraków-only: full sensor readings
  let primarySummary = null;
  let primaryReadings = undefined;
  if (cityParam === "krakow" && cityStations.length > 0) {
    const primary  = getPrimaryKrakowStation();
    primarySummary = primary.summary ?? null;
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
