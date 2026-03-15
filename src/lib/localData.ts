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

// ─── City slug helpers ────────────────────────────────────────────────────────

/**
 * Converts a city name to a URL-safe slug.
 * "Kraków" → "krakow", "Bielsko-Biała" → "bielsko-biala"
 */
export function cityToSlug(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Given a slug, returns the canonical city name from the station data (or null).
 * "krakow" → "Kraków"
 */
export function slugToCity(slug: string): string | null {
  const stations = getAllStations();
  const match = stations.find((s) => cityToSlug(s.city) === slug);
  return match?.city ?? null;
}

/**
 * Returns all stations for a given city slug.
 * Handles diacritic-normalised matching (e.g. "krakow" matches "Kraków").
 */
export function getStationsByCity(slug: string): StationSummary[] {
  const stations = getAllStations();
  return stations.filter((s) => cityToSlug(s.city) === slug);
}

/**
 * Returns a sorted list of all unique cities with their slugs.
 * Used to build the local search index.
 */
export function getAllCities(): Array<{ city: string; slug: string; voivodeship: string }> {
  const stations = getAllStations();
  const seen = new Map<string, { city: string; slug: string; voivodeship: string }>();
  for (const s of stations) {
    const slug = cityToSlug(s.city);
    if (!seen.has(slug)) {
      seen.set(slug, {
        city: s.city,
        slug,
        voivodeship: s.voivodeship,
      });
    }
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.city.localeCompare(b.city, "pl"),
  );
}

// ─── Kraków-specific ──────────────────────────────────────────────────────────

export function getKrakowStations(): StationSummary[] {
  return getStationsByCity("krakow");
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
