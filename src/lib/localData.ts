/**
 * localData.ts
 * Data access layer for the demo version of Powietrze.
 * Reads from local JSON snapshot files (src/data/) instead of Supabase or live APIs.
 * This allows the app to run without any environment variables or network access.
 *
 * When Supabase is wired up, these functions will be replaced with database queries
 * while keeping the same return shapes — the components won't need to change.
 */

import type { StationSummary, KrakowStation } from "./types";

// Next.js can statically import JSON in server components
import stationsSummary from "@/data/stations-summary.json";
import krakowReadings from "@/data/krakow-readings.json";

export function getAllStations(): StationSummary[] {
  return stationsSummary as StationSummary[];
}

export function getKrakowStations(): StationSummary[] {
  return getAllStations().filter(
    (s) => s.city.toLowerCase().includes("kraków") || s.city.toLowerCase().includes("krakow"),
  );
}

export function getStationById(id: string): StationSummary | undefined {
  return getAllStations().find((s) => s.id === id);
}

export function getKrakowReadings(): KrakowStation[] {
  return krakowReadings as KrakowStation[];
}

/** Returns the best-data Kraków station for the AQI hero widget.
 *  Priority: has pm25 + pm10 + aqi level */
export function getPrimaryKrakowStation(): {
  summary: StationSummary;
  readings: KrakowStation | undefined;
} {
  const summaries = getKrakowStations();
  const readings = getKrakowReadings();

  // Find the station with the most pollutant readings
  let bestSummary = summaries[0];
  let bestReadings: KrakowStation | undefined;
  let bestCount = 0;

  for (const s of summaries) {
    const r = readings.find((r) => r.id === s.id);
    if (r) {
      const count = Object.keys(r.pollutants).length;
      if (count > bestCount) {
        bestCount = count;
        bestSummary = s;
        bestReadings = r;
      }
    }
  }

  return { summary: bestSummary, readings: bestReadings };
}
