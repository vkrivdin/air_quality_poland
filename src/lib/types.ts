/**
 * types.ts
 * Shared TypeScript types used across the Powietrze app.
 * These mirror the shape of the local JSON data files and the Supabase schema.
 *
 * AQI level definitions, colours, and helpers have moved to aqi-config.ts.
 * Re-exported here for backwards compatibility during the Phase 2 refactor.
 */

export type { AqiLevelKey, ActivityKey, ActivityState, AqiLevelConfig } from "@/lib/aqi-config";
export { getLevelConfig, giosLabelToKey, pm25ToLevelKey } from "@/lib/aqi-config";

// Shape of one entry in stations-summary.json
export type StationSummary = {
  id: string;
  gios_id: number;
  code: string;
  name: string;
  city: string;
  street: string | null;
  commune: string;
  district: string;
  voivodeship: string;
  lat: number;
  lon: number;
  source: "gios";
  aqi: {
    level_name: string | null;
    level_name_en: string | null;
    score: number | null;
    color: string;
    calc_date: string | null;
    pm25_level: string | null;
    pm10_level: string | null;
    no2_level: string | null;
    o3_level: string | null;
    so2_level: string | null;
    co_level: string | null;
  };
};

// Shape of one entry in krakow-readings.json
export type PollutantReading = {
  date: string;
  value: number;
};

export type KrakowStation = {
  id: string;
  gios_id: number;
  name: string;
  city: string;
  lat: number;
  lon: number;
  pollutants: Partial<Record<string, PollutantReading>>;
  history: Partial<Record<string, PollutantReading[]>>;
};
