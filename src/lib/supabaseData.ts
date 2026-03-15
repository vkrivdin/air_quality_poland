/**
 * supabaseData.ts
 * Supabase-backed equivalents of every public function in localData.ts.
 * Return shapes are identical — page.tsx can swap between the two without
 * changing any component code.
 *
 * Used when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set in the environment
 * (production / staging). Falls back to localData.ts in demo mode.
 *
 * Key differences from localData.ts:
 *  - getAllStations() queries `stations` + latest `readings` per station,
 *    then assembles the StationSummary shape the UI expects.
 *  - getKrakowReadings() queries the last 24 h of readings for Kraków stations
 *    and maps them into the KrakowStation shape.
 *  - All functions are async (localData.ts functions are sync — page.tsx awaits both).
 *
 * Mapping notes:
 *  - `stations.latitude/longitude` → `StationSummary.lat/lon`
 *  - `readings.aqi_level` (Polish string) → `StationSummary.aqi.level_name`
 *  - `readings.pm25/pm10/no2` are index scores (0–5 × 10), not µg/m³.
 *    The UI shows them as level labels (Dobry / Umiarkowany / etc.) via
 *    aqi-config, so we convert the score back to a category label.
 */

import { getServiceClient } from "./supabase";
import { cityToSlug } from "./localData";
import type { StationSummary, KrakowStation, PollutantReading } from "./types";

// ─── Internal DB row types ────────────────────────────────────────────────────

type StationRow = {
  id: string;
  source: string;
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
  aqi_value: number | null;
  aqi_level: string | null;
};

// ─── Score → colour helper (matches aqi-config without importing it server-side) ──
// aqi_level from GIOŚ is already the Polish display string ("Dobry", "Umiarkowany" etc.)
// so we use it directly. The colour is derived on the client by getLevelConfig().
// We store a neutral fallback for the `color` field which is only used by legacy code.

const LEVEL_COLOUR_MAP: Record<string, string> = {
  "Bardzo dobry": "#4CAF50",
  "Dobry":        "#8BC34A",
  "Umiarkowany":  "#FFC107",
  "Zły":          "#FF5722",
  "Bardzo zły":   "#B71C1C",
};

function levelColour(level: string | null): string {
  if (!level) return "#9E9E9E";
  return LEVEL_COLOUR_MAP[level] ?? "#9E9E9E";
}

// ─── Core query: all stations with their latest reading ───────────────────────

async function fetchStationsWithLatestReading(): Promise<StationSummary[]> {
  const db = getServiceClient();

  // Fetch all active stations
  const { data: stations, error: stErr } = await db
    .from("stations")
    .select("id, source, name, city, latitude, longitude")
    .eq("is_active", true)
    .order("city", { ascending: true })
    .returns<StationRow[]>();

  if (stErr) throw new Error(`stations query failed: ${stErr.message}`);
  if (!stations || stations.length === 0) return [];

  // Fetch the latest reading per station using a subquery approach:
  // We get the single most recent reading for every station in one query.
  const stationIds = stations.map((s) => s.id);

  // Supabase doesn't support DISTINCT ON directly, so we fetch all recent
  // readings (last 2 hours) and pick the latest per station in JS.
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: readings, error: rErr } = await db
    .from("readings")
    .select("station_id, measured_at, pm25, pm10, no2, o3, so2, aqi_value, aqi_level")
    .in("station_id", stationIds)
    .gte("measured_at", since)
    .order("measured_at", { ascending: false })
    .returns<ReadingRow[]>();

  if (rErr) throw new Error(`readings query failed: ${rErr.message}`);

  // Index latest reading per station
  const latestByStation = new Map<string, ReadingRow>();
  for (const r of readings ?? []) {
    if (!latestByStation.has(r.station_id)) {
      latestByStation.set(r.station_id, r);
    }
  }

  // Assemble StationSummary rows
  return stations.map((s): StationSummary => {
    const r = latestByStation.get(s.id);
    return {
      id: s.id,
      gios_id: parseInt(s.id.replace("gios_", ""), 10) || 0,
      code: s.id,
      name: s.name,
      city: s.city,
      street: null,
      commune: s.city,
      district: s.city,
      voivodeship: "",
      lat: s.latitude,
      lon: s.longitude,
      source: "gios",
      aqi: {
        level_name:    r?.aqi_level ?? null,
        level_name_en: null,
        score:         r?.aqi_value !== null && r?.aqi_value !== undefined ? r.aqi_value / 10 : null,
        color:         levelColour(r?.aqi_level ?? null),
        calc_date:     r?.measured_at ?? null,
        pm25_level:    r?.pm25 !== null && r?.pm25 !== undefined ? String(r.pm25) : null,
        pm10_level:    r?.pm10 !== null && r?.pm10 !== undefined ? String(r.pm10) : null,
        no2_level:     r?.no2  !== null && r?.no2  !== undefined ? String(r.no2)  : null,
        o3_level:      r?.o3   !== null && r?.o3   !== undefined ? String(r.o3)   : null,
        so2_level:     r?.so2  !== null && r?.so2  !== undefined ? String(r.so2)  : null,
        co_level:      null,
      },
    };
  });
}

// ─── Public API — mirrors localData.ts signatures ────────────────────────────

export async function getAllStations(): Promise<StationSummary[]> {
  return fetchStationsWithLatestReading();
}

export async function getStationsByCity(slug: string): Promise<StationSummary[]> {
  const all = await fetchStationsWithLatestReading();
  return all.filter((s) => cityToSlug(s.city) === slug);
}

export async function slugToCity(slug: string): Promise<string | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("stations")
    .select("city")
    .eq("city_normalized", slug.replace(/-/g, ""))
    .limit(1)
    .returns<{ city: string }[]>();

  if (error || !data || data.length === 0) return null;
  return data[0].city;
}

export async function getKrakowReadings(): Promise<KrakowStation[]> {
  const db = getServiceClient();

  // Get all Kraków station IDs
  const { data: stations, error: sErr } = await db
    .from("stations")
    .select("id, name")
    .eq("city", "Kraków")
    .eq("is_active", true)
    .returns<{ id: string; name: string }[]>();

  if (sErr || !stations || stations.length === 0) return [];

  const stationIds = stations.map((s) => s.id);

  // Last 24 h of readings
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: readings, error: rErr } = await db
    .from("readings")
    .select("station_id, measured_at, pm25, pm10, no2, o3, so2, aqi_level")
    .in("station_id", stationIds)
    .gte("measured_at", since)
    .order("measured_at", { ascending: true })
    .returns<ReadingRow[]>();

  if (rErr || !readings) return [];

  // Build a station lookup for lat/lon
  const stationMeta = new Map<string, StationRow>();
  for (const s of stations) stationMeta.set(s.id, s as unknown as StationRow);

  // Group readings by station → KrakowStation shape
  return (stations as { id: string; name: string }[]).map((s): KrakowStation => {
    const meta = stationMeta.get(s.id);
    const stationReadings = readings.filter((r) => r.station_id === s.id);
    const latest = stationReadings.at(-1);

    const pollutants: KrakowStation["pollutants"] = {};
    const history: KrakowStation["history"] = {};

    // Helper: build history array for a pollutant column
    const toHistory = (param: keyof ReadingRow): PollutantReading[] =>
      stationReadings
        .filter((r) => r[param] !== null)
        .map((r) => ({ date: r.measured_at, value: r[param] as number }));

    if (latest?.pm25 !== null && latest?.pm25 !== undefined) {
      pollutants["PM2.5"] = { date: latest.measured_at, value: latest.pm25 };
      history["PM2.5"] = toHistory("pm25");
    }
    if (latest?.pm10 !== null && latest?.pm10 !== undefined) {
      pollutants["PM10"] = { date: latest.measured_at, value: latest.pm10 };
      history["PM10"] = toHistory("pm10");
    }
    if (latest?.no2 !== null && latest?.no2 !== undefined) {
      pollutants["NO2"] = { date: latest.measured_at, value: latest.no2 };
      history["NO2"] = toHistory("no2");
    }

    return {
      id: s.id,
      gios_id: parseInt(s.id.replace("gios_", ""), 10) || 0,
      name: s.name,
      city: "Kraków",
      lat: meta?.latitude ?? 50.06,
      lon: meta?.longitude ?? 19.94,
      pollutants,
      history,
    };
  });
}

export async function getPrimaryKrakowStation(): Promise<{
  summary: StationSummary | null;
  readings: KrakowStation | undefined;
}> {
  const [summaries, readings] = await Promise.all([
    getStationsByCity("krakow"),
    getKrakowReadings(),
  ]);

  if (summaries.length === 0) return { summary: null, readings: undefined };

  // Pick station with most pollutant data
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
