/**
 * localDb.ts
 * SQLite data access layer for Powietrze.
 *
 * Reads from data/local.db (the SQLite database populated by the harvest scripts).
 * Returns the SAME TypeScript shapes as localData.ts (StationSummary, KrakowStation)
 * so all existing components work without modification.
 *
 * This file is SERVER-ONLY — never import it in a Client Component.
 * It uses better-sqlite3 (synchronous, Node.js only).
 *
 * Swap strategy: page.tsx checks USE_LOCAL_DB env flag and calls either
 * this module or localData.ts (JSON snapshots) or supabaseData.ts (Supabase).
 * The return shapes are identical across all three — components never need
 * to know which data source is active.
 */

import Database from "better-sqlite3";
import path from "path";
import { giosLabelToKey } from "@/lib/aqi-config";
import type { StationSummary, KrakowStation } from "@/lib/types";

// ─── DB connection ────────────────────────────────────────────────────────────

const DB_PATH = path.resolve(process.cwd(), "data/local.db");

/**
 * Opens a read-only connection to local.db.
 * Returns null if the file does not exist (graceful fallback).
 */
function openDb(): Database.Database | null {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    db.pragma("journal_mode = WAL");
    return db;
  } catch {
    return null;
  }
}

// ─── Row types (internal, not exported) ──────────────────────────────────────

type StationRow = {
  id: string;
  gios_id: number;
  code: string;
  name: string;
  city: string;
  street: string | null;
  commune: string;
  district: string;
  voivodeship: string;
  latitude: number;
  longitude: number;
  source: string;
};

type ReadingRow = {
  station_id: string;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  so2: number | null;
  co: number | null;
  c6h6: number | null;
  aqi_value: number | null;
  aqi_level: string | null;
  measured_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a city name to a URL-safe slug (identical logic to localData.ts).
 */
export function cityToSlug(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Maps a GIOŚ level string to an AQI color hex for StationSummary.aqi.color.
 * Kept here so we don't need aqi-config in every SQL row transform.
 */
function levelToColor(level: string | null): string {
  const cfg = giosLabelToKey(level);
  const colors: Record<string, string> = {
    bardzo_dobry: "#2E9E5A",
    dobry: "#8AB61F",
    umiarkowany: "#EABF00",
    zly: "#E87B24",
    bardzo_zly: "#C72E2E",
    no_data: "#9E9E9E",
  };
  return colors[cfg] ?? "#9E9E9E";
}

/**
 * Merges station metadata with the most recent reading row into a StationSummary.
 */
function toStationSummary(
  station: StationRow,
  reading: ReadingRow | null
): StationSummary {
  return {
    id: station.id,
    gios_id: station.gios_id,
    code: station.code ?? "",
    name: station.name,
    city: station.city,
    street: station.street,
    commune: station.commune ?? "",
    district: station.district ?? "",
    voivodeship: station.voivodeship ?? "",
    lat: station.latitude,
    lon: station.longitude,
    source: "gios",
    aqi: {
      level_name: reading?.aqi_level ?? null,
      level_name_en: reading?.aqi_level ?? null,
      score: reading?.aqi_value ?? null,
      color: levelToColor(reading?.aqi_level ?? null),
      calc_date: reading?.measured_at ?? null,
      pm25_level: null,
      pm10_level: null,
      no2_level: null,
      o3_level: null,
      so2_level: null,
      co_level: null,
    },
  };
}

// ─── Core query: latest reading per station ────────────────────────────────────

/**
 * Returns the best available reading for each station:
 * - For AQI level/color: the most recent AQI snapshot row (sensor_id IS NULL)
 * - For pollutant values (pm25, pm10, no2...): the most recent sensor row (sensor_id NOT NULL)
 *
 * These are merged into one synthetic ReadingRow per station so components
 * see both a valid aqi_level AND real µg/m³ values.
 *
 * Background: AQI snapshot rows store GIOŚ sub-index scores (0–5) in the
 * pm25/pm10/no2 columns — NOT µg/m³. Only sensor harvest rows have real values.
 */
function getLatestReadings(db: Database.Database): Map<string, ReadingRow> {
  // Strip timezone suffix so string comparison works with stored naive timestamps
  const nowStr = new Date().toISOString().replace(/\+.*$/, "").replace(/Z$/, "");

  // Latest AQI snapshot per station (aqi_level + aqi_value)
  const snapshotRows = db
    .prepare(
      `SELECT r.*
       FROM readings r
       INNER JOIN (
         SELECT station_id, MAX(measured_at) AS latest
         FROM readings
         WHERE sensor_id IS NULL
         GROUP BY station_id
       ) best ON r.station_id = best.station_id
             AND r.measured_at = best.latest
             AND r.sensor_id IS NULL`
    )
    .all() as ReadingRow[];

  const snapshotMap = new Map<string, ReadingRow>();
  for (const row of snapshotRows) {
    if (!snapshotMap.has(row.station_id)) {
      snapshotMap.set(row.station_id, row);
    }
  }

  // Latest real sensor readings per station (real µg/m³ values)
  // Pick the row with the most non-null pollutant columns among tied timestamps
  const sensorRows = db
    .prepare(
      `SELECT r.*,
              (CASE WHEN r.pm25 IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN r.pm10 IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN r.no2  IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN r.o3   IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN r.so2  IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN r.co   IS NOT NULL THEN 1 ELSE 0 END) AS data_cols
       FROM readings r
       INNER JOIN (
         SELECT station_id, MAX(measured_at) AS latest
         FROM readings
         WHERE sensor_id IS NOT NULL
         GROUP BY station_id
       ) best ON r.station_id = best.station_id
             AND r.measured_at = best.latest
             AND r.sensor_id IS NOT NULL
       ORDER BY r.station_id, data_cols DESC`
    )
    .all() as (ReadingRow & { data_cols: number })[];

  const sensorMap = new Map<string, ReadingRow>();
  for (const row of sensorRows) {
    // Keep only the first (highest data_cols) row per station
    if (!sensorMap.has(row.station_id)) {
      sensorMap.set(row.station_id, row);
    }
  }

  // Merge: AQI level from snapshot + real pollutant values from sensor harvest
  const merged = new Map<string, ReadingRow>();
  const allStationIds = new Set([
    ...snapshotMap.keys(),
    ...sensorMap.keys(),
  ]);

  for (const stationId of allStationIds) {
    const snap   = snapshotMap.get(stationId);
    const sensor = sensorMap.get(stationId);

    if (snap && sensor) {
      // Use snapshot for aqi fields, sensor for pollutant values
      merged.set(stationId, {
        ...sensor,
        aqi_level: snap.aqi_level,
        aqi_value: snap.aqi_value,
        measured_at: snap.measured_at, // freshness timestamp from snapshot
      });
    } else if (snap) {
      // Only snapshot — clear the sub-index scores from pm25/pm10 columns
      // (they are GIOŚ index scores 0–5, not µg/m³)
      merged.set(stationId, {
        ...snap,
        pm25: null,
        pm10: null,
        no2: null,
        o3: null,
        so2: null,
        co: null,
        c6h6: null,
      });
    } else if (sensor) {
      merged.set(stationId, sensor);
    }
  }

  void nowStr; // suppress unused var warning
  return merged;
}

// ─── Public API (mirrors localData.ts) ────────────────────────────────────────

/**
 * Returns all stations with their latest AQI readings.
 * Falls back to an empty array if local.db is unavailable.
 */
export function getAllStations(): StationSummary[] {
  const db = openDb();
  if (!db) return [];

  const stations = db
    .prepare("SELECT * FROM stations WHERE is_active = 1 ORDER BY city, name")
    .all() as StationRow[];

  const latestReadings = getLatestReadings(db);
  db.close();

  return stations.map((s) => toStationSummary(s, latestReadings.get(s.id) ?? null));
}

/**
 * Given a city slug, returns all stations for that city.
 */
export function getStationsByCity(slug: string): StationSummary[] {
  return getAllStations().filter((s) => cityToSlug(s.city) === slug);
}

/**
 * Given a slug, returns the canonical city name (or null).
 */
export function slugToCity(slug: string): string | null {
  const match = getAllStations().find((s) => cityToSlug(s.city) === slug);
  return match?.city ?? null;
}

/**
 * Returns all unique cities with slugs and voivodeships.
 */
export function getAllCities(): Array<{
  city: string;
  slug: string;
  voivodeship: string;
}> {
  const seen = new Map<string, { city: string; slug: string; voivodeship: string }>();
  for (const s of getAllStations()) {
    const slug = cityToSlug(s.city);
    if (!seen.has(slug)) {
      seen.set(slug, { city: s.city, slug, voivodeship: s.voivodeship });
    }
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.city.localeCompare(b.city, "pl")
  );
}

/**
 * Returns the station with the most available pollutant readings in a city.
 * Used as the "primary" station for the AQI hero widget.
 */
export function getPrimaryStation(citySlug: string): {
  summary: StationSummary;
  readings: KrakowStation | undefined;
} {
  const db = openDb();
  const cityStations = getStationsByCity(citySlug);

  if (cityStations.length === 0 || !db) {
    return { summary: cityStations[0] ?? ({} as StationSummary), readings: undefined };
  }

  // Find the station with the most non-null pollutant readings
  const cityName = cityStations[0].city;
  const rows = db
    .prepare(
      `
      SELECT r.station_id,
             COUNT(CASE WHEN r.pm25 IS NOT NULL THEN 1 END) +
             COUNT(CASE WHEN r.pm10 IS NOT NULL THEN 1 END) +
             COUNT(CASE WHEN r.no2  IS NOT NULL THEN 1 END) +
             COUNT(CASE WHEN r.o3   IS NOT NULL THEN 1 END) +
             COUNT(CASE WHEN r.so2  IS NOT NULL THEN 1 END) +
             COUNT(CASE WHEN r.co   IS NOT NULL THEN 1 END) AS data_count
      FROM readings r
      JOIN stations s ON r.station_id = s.id
      WHERE s.city = ?
      GROUP BY r.station_id
      ORDER BY data_count DESC
      LIMIT 1
    `
    )
    .get(cityName) as { station_id: string; data_count: number } | undefined;

  const primaryId = rows?.station_id;
  const primarySummary =
    cityStations.find((s) => s.id === primaryId) ?? cityStations[0];

  // Build KrakowStation-compatible readings shape from recent history
  const history = buildStationHistory(db, primarySummary.id);
  db.close();

  const readings: KrakowStation = {
    id: primarySummary.id,
    gios_id: primarySummary.gios_id,
    name: primarySummary.name,
    city: primarySummary.city,
    lat: primarySummary.lat,
    lon: primarySummary.lon,
    pollutants: history.latest,
    history: history.series,
  };

  return { summary: primarySummary, readings };
}

/**
 * Convenience alias used by page.tsx (Kraków-specific legacy call).
 */
export function getPrimaryKrakowStation(): {
  summary: StationSummary;
  readings: KrakowStation | undefined;
} {
  return getPrimaryStation("krakow");
}

export function getStationById(id: string): StationSummary | undefined {
  return getAllStations().find((s) => s.id === id);
}

// ─── Readings history ─────────────────────────────────────────────────────────

type LatestPollutants = Partial<Record<string, { date: string; value: number }>>;
type PollutantSeries = Partial<Record<string, Array<{ date: string; value: number }>>>;

/**
 * Builds the pollutants (latest single reading) and history (time series)
 * objects for a station — matching the KrakowStation shape.
 */
function buildStationHistory(
  db: Database.Database,
  stationId: string
): { latest: LatestPollutants; series: PollutantSeries } {
  // Last 72 hours of readings
  const cutoff = new Date(Date.now() - 72 * 3600 * 1000).toISOString();

  const rows = db
    .prepare(
      `
      SELECT measured_at, pm25, pm10, no2, o3, so2, co, c6h6
      FROM readings
      WHERE station_id = ? AND measured_at >= ?
      ORDER BY measured_at DESC
    `
    )
    .all(stationId, cutoff) as Array<{
    measured_at: string;
    pm25: number | null;
    pm10: number | null;
    no2: number | null;
    o3: number | null;
    so2: number | null;
    co: number | null;
    c6h6: number | null;
  }>;

  const COLS = ["pm25", "pm10", "no2", "o3", "so2", "co", "c6h6"] as const;

  const latest: LatestPollutants = {};
  const series: PollutantSeries = {};

  // rows are DESC so first hit per column is the most recent
  for (const row of rows) {
    for (const col of COLS) {
      const val = row[col];
      if (val === null) continue;

      if (!latest[col]) {
        latest[col] = { date: row.measured_at, value: val };
      }

      if (!series[col]) series[col] = [];
      series[col]!.push({ date: row.measured_at, value: val });
    }
  }

  return { latest, series };
}

/**
 * Returns up to `days` days of hourly readings for a specific sensor column.
 * Used by charting components (PollutantChart, StationTrendMini).
 */
export function getDailyReadings(
  stationId: string,
  column: "pm25" | "pm10" | "no2" | "o3" | "so2" | "co" | "c6h6",
  days = 7
): Array<{ date: string; value: number }> {
  const db = openDb();
  if (!db) return [];

  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const rows = db
    .prepare(
      `
      SELECT measured_at as date, ${column} as value
      FROM readings
      WHERE station_id = ? AND ${column} IS NOT NULL AND measured_at >= ?
      ORDER BY measured_at ASC
    `
    )
    .all(stationId, cutoff) as Array<{ date: string; value: number }>;

  db.close();
  return rows;
}
