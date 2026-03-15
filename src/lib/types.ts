/**
 * types.ts
 * Shared TypeScript types used across the Powietrze app.
 * These mirror the shape of the local JSON data files and the Supabase schema.
 */

export type AqiLevel =
  | "Bardzo dobry"
  | "Dobry"
  | "Umiarkowany"
  | "Dostateczny"
  | "Zły"
  | "Bardzo zły"
  | "Brak indeksu"
  | null;

export type AqiMeta = {
  score: number;
  label_pl: string;
  label_en: string;
  color: string;
  bgClass: string;
  textClass: string;
};

export const AQI_LEVELS: Record<string, AqiMeta> = {
  "Bardzo dobry": {
    score: 1,
    label_pl: "Bardzo dobry",
    label_en: "Very Good",
    color: "#00BCD4",
    bgClass: "bg-cyan-500",
    textClass: "text-cyan-400",
  },
  Dobry: {
    score: 2,
    label_pl: "Dobry",
    label_en: "Good",
    color: "#4CAF50",
    bgClass: "bg-green-500",
    textClass: "text-green-400",
  },
  Umiarkowany: {
    score: 3,
    label_pl: "Umiarkowany",
    label_en: "Moderate",
    color: "#FFEB3B",
    bgClass: "bg-yellow-400",
    textClass: "text-yellow-400",
  },
  Dostateczny: {
    score: 4,
    label_pl: "Dostateczny",
    label_en: "Sufficient",
    color: "#FF9800",
    bgClass: "bg-orange-500",
    textClass: "text-orange-400",
  },
  Zły: {
    score: 5,
    label_pl: "Zły",
    label_en: "Bad",
    color: "#F44336",
    bgClass: "bg-red-500",
    textClass: "text-red-400",
  },
  "Bardzo zły": {
    score: 6,
    label_pl: "Bardzo zły",
    label_en: "Very Bad",
    color: "#9C27B0",
    bgClass: "bg-purple-600",
    textClass: "text-purple-400",
  },
};

export const AQI_FALLBACK: AqiMeta = {
  score: 0,
  label_pl: "Brak danych",
  label_en: "No data",
  color: "#6B7280",
  bgClass: "bg-gray-500",
  textClass: "text-gray-400",
};

export function getAqiMeta(levelName: string | null | undefined): AqiMeta {
  if (!levelName) return AQI_FALLBACK;
  return AQI_LEVELS[levelName] ?? AQI_FALLBACK;
}

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
    level_name: AqiLevel;
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
