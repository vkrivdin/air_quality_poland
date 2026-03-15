/**
 * aqi-config.ts
 *
 * SINGLE SOURCE OF TRUTH for all AQI level definitions, activity thresholds,
 * UI copy, colours, and external benchmark values.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RULE: No threshold value, benchmark figure, or UI copy string related to AQI
 * may appear anywhere else in the codebase. Import from here.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * When a benchmark changes (e.g. WHO revises guidelines, EU amends a directive):
 *   1. Update docs/aqi-config-spec.md first.
 *   2. Update the value here.
 *   3. Commit both files together: `data: update [benchmark] to [value] — [source]`
 *
 * See docs/aqi-config-spec.md for full source citations and review schedule.
 */

// ─── Level keys ──────────────────────────────────────────────────────────────

export type AqiLevelKey =
  | "bardzo_dobry"
  | "dobry"
  | "umiarkowany"
  | "zly"
  | "bardzo_zly"
  | "no_data";

// ─── Activity keys ────────────────────────────────────────────────────────────

export type ActivityKey =
  | "running"
  | "cycling"
  | "walking"
  | "kids_outside"
  | "ventilate";

export type ActivityState = "safe" | "caution" | "avoid";

export type ActivityCell = {
  state: ActivityState;
  note_pl: string | null; // ≤5 words; null = no sub-label needed
  note_en: string | null;
};

// ─── Level definition ─────────────────────────────────────────────────────────

export type AqiLevelConfig = {
  key: AqiLevelKey;
  score: number;           // 1 (best) – 5 (worst); 0 for no_data
  label_pl: string;
  label_en: string;
  pm25_min: number;        // µg/m³ inclusive lower bound
  pm25_max: number;        // µg/m³ exclusive upper bound (Infinity for last level)
  color: {
    primary: string;       // solid colour for markers, chart lines
    bg: string;            // 10%-opacity background for cards, banners
    border: string;        // 50%-opacity border
    text: string;          // text on white background
  };
  copy: {
    headline_pl: string;   // imperative headline on dashboard card
    headline_en: string;
    context_pl: string;    // 1–2 sentence contextual note below activity matrix
    context_en: string;
  };
  activities: Record<ActivityKey, ActivityCell>;
};

// ─── Level configurations ─────────────────────────────────────────────────────

export const AQI_LEVEL_CONFIGS: Record<Exclude<AqiLevelKey, "no_data">, AqiLevelConfig> = {

  bardzo_dobry: {
    key: "bardzo_dobry",
    score: 1,
    label_pl: "Bardzo dobry",
    label_en: "Very good",
    pm25_min: 0,
    pm25_max: 10,
    color: {
      primary: "#3B6D11",
      bg:      "#EAF3DE",
      border:  "#97C459",
      text:    "#27500A",
    },
    copy: {
      headline_pl: "Powietrze jest czyste. Biegnij, jedź na rower, wietrz mieszkanie.",
      headline_en: "Air is clean. Run, cycle, open your windows.",
      context_pl:  "Takie dni w Krakowie są rzadkie zimą — to typowy poziom latem lub po deszczu. Korzystaj z tego.",
      context_en:  "Days like this are rare in Kraków in winter — typical in summer or after rain. Make the most of it.",
    },
    activities: {
      running:      { state: "safe",    note_pl: null,                    note_en: null },
      cycling:      { state: "safe",    note_pl: null,                    note_en: null },
      walking:      { state: "safe",    note_pl: null,                    note_en: null },
      kids_outside: { state: "safe",    note_pl: null,                    note_en: null },
      ventilate:    { state: "safe",    note_pl: "Wietrz śmiało",         note_en: "Ventilate freely" },
    },
  },

  dobry: {
    key: "dobry",
    score: 2,
    label_pl: "Dobry",
    label_en: "Good",
    pm25_min: 10,
    pm25_max: 20,
    color: {
      primary: "#0F6E56",
      bg:      "#E1F5EE",
      border:  "#5DCAA5",
      text:    "#085041",
    },
    copy: {
      headline_pl: "Aktywność na świeżym powietrzu jest bezpieczna.",
      headline_en: "Outdoor activity is safe for most people.",
      context_pl:  "Ten poziom przekracza roczny cel WHO (5 µg/m³) — bezpieczny dziś, ale nie bez znaczenia przy wieloletniej ekspozycji.",
      context_en:  "This level still exceeds the WHO annual guideline (5 µg/m³) — safe today, but not without long-term cost.",
    },
    activities: {
      running:      { state: "safe",    note_pl: null,                    note_en: null },
      cycling:      { state: "safe",    note_pl: null,                    note_en: null },
      walking:      { state: "safe",    note_pl: null,                    note_en: null },
      kids_outside: { state: "safe",    note_pl: null,                    note_en: null },
      ventilate:    { state: "safe",    note_pl: "Wietrz śmiało",         note_en: "Ventilate freely" },
    },
  },

  umiarkowany: {
    key: "umiarkowany",
    score: 3,
    label_pl: "Umiarkowany",
    label_en: "Moderate",
    pm25_min: 20,
    pm25_max: 35,
    color: {
      primary: "#854F0B",
      bg:      "#FAEEDA",
      border:  "#EF9F27",
      text:    "#633806",
    },
    copy: {
      headline_pl: "Ogranicz intensywną aktywność. Spacer jest OK — długi bieg już nie.",
      headline_en: "Limit intense activity. A walk is fine — a long run is not.",
      context_pl:  "Typowy poziom w Krakowie w łagodny dzień zimowy. Zdrowe osoby dorosłe mogą być aktywne krótko. Dzieci, seniorzy i astmatycy — zostańcie w domu lub skróćcie wyjście.",
      context_en:  "Kraków's typical level on a mild winter day. Healthy adults can be briefly active. Children, elderly, and those with asthma should limit exposure.",
    },
    activities: {
      running:      { state: "caution", note_pl: "Max 30 min",            note_en: "Max 30 min" },
      cycling:      { state: "caution", note_pl: "Unikaj ruchliwych ulic",note_en: "Avoid busy roads" },
      walking:      { state: "safe",    note_pl: null,                    note_en: null },
      kids_outside: { state: "caution", note_pl: "Skróć czas pobytu",     note_en: "Shorten time outside" },
      ventilate:    { state: "caution", note_pl: "Krótko, rano",          note_en: "Briefly, in morning" },
    },
  },

  zly: {
    key: "zly",
    score: 4,
    label_pl: "Zły",
    label_en: "Bad",
    pm25_min: 35,
    pm25_max: 75,
    color: {
      primary: "#993C1D",
      bg:      "#FAECE7",
      border:  "#F0997B",
      text:    "#712B13",
    },
    copy: {
      headline_pl: "Smog. Nie biegaj, nie jedź na rowerze. Dzieci i seniorzy zostają w domu.",
      headline_en: "Smog. No running, no cycling. Kids and elderly stay indoors.",
      context_pl:  "Sezon grzewczy w Krakowie. Główne źródło: piece węglowe i kominki w okolicznych gminach — nie transport. Jeśli musisz wyjść — załóż maskę FFP2.",
      context_en:  "Heating season in Kraków. The primary source is coal boilers and fireplaces in surrounding areas — not traffic. If you must go outside — wear an FFP2 mask.",
    },
    activities: {
      running:      { state: "avoid",   note_pl: "Unikaj",                note_en: "Avoid" },
      cycling:      { state: "avoid",   note_pl: "Unikaj",                note_en: "Avoid" },
      walking:      { state: "caution", note_pl: "Tylko w razie potrzeby",note_en: "Essential only" },
      kids_outside: { state: "avoid",   note_pl: "Zostań w domu",         note_en: "Stay indoors" },
      ventilate:    { state: "avoid",   note_pl: "Zamknij okna",          note_en: "Close windows" },
    },
  },

  bardzo_zly: {
    key: "bardzo_zly",
    score: 5,
    label_pl: "Bardzo zły",
    label_en: "Very bad",
    pm25_min: 75,
    pm25_max: Infinity,
    color: {
      primary: "#A32D2D",
      bg:      "#FCEBEB",
      border:  "#F09595",
      text:    "#791F1F",
    },
    copy: {
      headline_pl: "Alarm smogowy. Zostań w domu. Zamknij wszystkie okna.",
      headline_en: "Smog alert. Stay indoors. Close all windows.",
      context_pl:  "Ten poziom przekracza polski próg alarmu smogowego. PM2.5 jest 15-krotnie powyżej rocznej normy WHO. Godzina na zewnątrz przy tym poziomie to ekspozycja porównywalna z wypaleniem kilku papierosów.",
      context_en:  "This level exceeds the Polish official smog alert threshold. PM2.5 is 15× the WHO annual guideline. One hour outside at this level carries exposure equivalent to smoking several cigarettes.",
    },
    activities: {
      running:      { state: "avoid",   note_pl: "Unikaj",                note_en: "Avoid" },
      cycling:      { state: "avoid",   note_pl: "Unikaj",                note_en: "Avoid" },
      walking:      { state: "avoid",   note_pl: "Unikaj",                note_en: "Avoid" },
      kids_outside: { state: "avoid",   note_pl: "Zostań w domu",         note_en: "Stay indoors" },
      ventilate:    { state: "avoid",   note_pl: "Zamknij wszystkie okna",note_en: "Close all windows" },
    },
  },
};

// Fallback for no_data / unknown levels
export const AQI_NO_DATA_CONFIG: Pick<AqiLevelConfig, "key" | "score" | "label_pl" | "label_en" | "color"> = {
  key:      "no_data",
  score:    0,
  label_pl: "Brak danych",
  label_en: "No data",
  color: {
    primary: "#5F5E5A",
    bg:      "#F1EFE8",
    border:  "#B4B2A9",
    text:    "#444441",
  },
};

// ─── GIOŚ API level name → internal key ──────────────────────────────────────
// Maps the raw string returned by GIOŚ API to our internal AqiLevelKey.
// "Dostateczny" is intentionally absent — treat as no_data if encountered.

export const GIOS_LEVEL_NAME_MAP: Record<string, Exclude<AqiLevelKey, "no_data">> = {
  "Bardzo dobry": "bardzo_dobry",
  "Dobry":        "dobry",
  "Umiarkowany":  "umiarkowany",
  "Zły":          "zly",
  "Bardzo zły":   "bardzo_zly",
};

// ─── Helper: PM2.5 value → level key ─────────────────────────────────────────

export function pm25ToLevelKey(pm25: number): Exclude<AqiLevelKey, "no_data"> {
  if (pm25 < 10)  return "bardzo_dobry";
  if (pm25 < 20)  return "dobry";
  if (pm25 < 35)  return "umiarkowany";
  if (pm25 < 75)  return "zly";
  return "bardzo_zly";
}

// ─── Helper: level key → config (with no_data fallback) ──────────────────────

export function getLevelConfig(key: AqiLevelKey | null | undefined): AqiLevelConfig | typeof AQI_NO_DATA_CONFIG {
  if (!key || key === "no_data") return AQI_NO_DATA_CONFIG;
  return AQI_LEVEL_CONFIGS[key] ?? AQI_NO_DATA_CONFIG;
}

// ─── Helper: GIOŚ string → level key ─────────────────────────────────────────

export function giosLabelToKey(label: string | null | undefined): AqiLevelKey {
  if (!label) return "no_data";
  return GIOS_LEVEL_NAME_MAP[label] ?? "no_data";
}

// ─── External benchmarks ─────────────────────────────────────────────────────
//
// ALL benchmark values live here. Zero exceptions.
// See docs/aqi-config-spec.md section 6 for full source citations.

export const BENCHMARKS = {
  // Kraków measured annual average PM2.5
  // Source: Applied Sciences study, Nov 2025 (9-city Poland analysis)
  // Review: update when GIOŚ publishes new annual report (typically Q1)
  krakow_annual_pm25: 31,

  // EU Directive 2008/50/EC — current enforceable annual limit
  // No change expected before 2030
  eu_current_limit_pm25: 25,

  // EU Directive 2024/2881 — annual limit binding from 1 January 2030
  // Poland must transpose into national law by 11 December 2026
  eu_2030_target_pm25: 10,
  eu_2030_deadline_year: 2030,
  eu_transposition_deadline: "2026-12-11",

  // WHO Air Quality Guidelines, September 2021
  // Next revision expected ~2030–2031
  who_annual_pm25: 5,
  who_24h_pm25: 15,

  // Polish regulatory thresholds (Rozporządzenie Ministra Środowiska, 2019)
  // Monitor for updates during EU Directive transposition
  polish_alert_threshold_pm10: 150,
  polish_information_threshold_pm10: 100,

  // Boiler source share in Poland
  // Source: KOBiZE estimates, cited in Polish Smog Alert
  household_boiler_pm_share_pct: 80,   // ~80% of PM from household boilers
  household_boiler_bap_share_pct: 90,  // ~90% of benzo[a]pyrene from household boilers
} as const;

// ─── Computed compliance badge ────────────────────────────────────────────────
// Use this function to get the badge copy — never hardcode "3×" in a component.

export type ComplianceBadgeVariant = "below_who" | "above_who" | "above_eu_current" | "above_eu_2030";

export function getComplianceBadge(annualPm25: number = BENCHMARKS.krakow_annual_pm25): {
  variant: ComplianceBadgeVariant;
  text_pl: string;
  text_en: string;
  severity: "green" | "amber" | "red";
} {
  const ratio2030 = Math.round(annualPm25 / BENCHMARKS.eu_2030_target_pm25);

  if (annualPm25 <= BENCHMARKS.who_annual_pm25) {
    return { variant: "below_who",       text_pl: "Poniżej normy WHO",               text_en: "Below WHO guideline",              severity: "green" };
  }
  if (annualPm25 <= BENCHMARKS.eu_current_limit_pm25) {
    return { variant: "above_who",       text_pl: "Powyżej normy WHO",               text_en: "Above WHO guideline",              severity: "amber" };
  }
  return   { variant: "above_eu_2030",   text_pl: `${ratio2030}× powyżej normy UE 2030`, text_en: `${ratio2030}× above EU 2030 target`, severity: "red"   };
}

// ─── Seasonal context rules ───────────────────────────────────────────────────

export type SeasonalRule = {
  id: string;
  condition: (month: number, levelKey: AqiLevelKey) => boolean;
  message_pl: string;
  message_en: string;
};

// Months are 1-indexed (1 = January, 12 = December)
const HEATING_MONTHS = [11, 12, 1, 2];
const BAD_OR_WORSE: AqiLevelKey[] = ["umiarkowany", "zly", "bardzo_zly"];
const VERY_BAD_OR_WORSE: AqiLevelKey[] = ["zly", "bardzo_zly"];
const GOOD_OR_BETTER: AqiLevelKey[] = ["bardzo_dobry", "dobry"];

export const SEASONAL_RULES: SeasonalRule[] = [
  {
    id: "heating_season",
    condition: (month, level) => HEATING_MONTHS.includes(month) && (BAD_OR_WORSE as string[]).includes(level),
    message_pl: "Sezon grzewczy. Główne źródło smogu: piece i kominki w okolicznych gminach, nie transport.",
    message_en: "Heating season. Primary source: boilers and fireplaces in surrounding municipalities, not traffic.",
  },
  {
    id: "boiler_ban",
    condition: (month, level) => HEATING_MONTHS.includes(month) && (VERY_BAD_OR_WORSE as string[]).includes(level),
    message_pl: "Spalanie węgla i drewna w Krakowie jest zakazane od 2019 r.",
    message_en: "Coal and wood burning in Kraków has been banned since 2019.",
  },
];

// good_day rule is handled separately in the component because it requires
// a runtime percentile value from Supabase.
// Minimum data requirement before showing percentile: 30 days of readings.
export const GOOD_DAY_MIN_DAYS = 30;
export const GOOD_DAY_LEVELS: AqiLevelKey[] = ["bardzo_dobry", "dobry"];

// ─── Activity display order ───────────────────────────────────────────────────
// Controls the order activities are rendered in the matrix UI.

export const ACTIVITY_DISPLAY_ORDER: ActivityKey[] = [
  "running",
  "cycling",
  "walking",
  "kids_outside",
  "ventilate",
];

// ─── Activity labels ──────────────────────────────────────────────────────────

export const ACTIVITY_LABELS: Record<ActivityKey, { pl: string; en: string }> = {
  running:      { pl: "Bieganie",       en: "Running" },
  cycling:      { pl: "Rower",          en: "Cycling" },
  walking:      { pl: "Spacer",         en: "Walking" },
  kids_outside: { pl: "Dzieci na dworze", en: "Kids outside" },
  ventilate:    { pl: "Wietrzenie",     en: "Ventilate home" },
};

// ─── UI disclaimer ────────────────────────────────────────────────────────────

export const DISCLAIMER = {
  pl: "Progi aktywności oparte na wytycznych WHO (2021) oraz klasyfikacji polskiego indeksu jakości powietrza GIOŚ. Dane o stężeniach PM2.5 i PM10 pochodzą z sieci GIOŚ i Airly. Cele redukcyjne na podstawie Dyrektywy UE 2024/2881. Informacje mają charakter orientacyjny. Osoby z chorobami układu oddechowego lub serca powinny skonsultować się z lekarzem.",
  en: "Activity thresholds based on WHO guidelines (2021) and the Polish GIOŚ air quality index. Concentration data from GIOŚ and Airly sensor networks. Reduction targets based on EU Directive 2024/2881. Information is indicative only. People with respiratory or cardiovascular conditions should consult a doctor.",
} as const;
