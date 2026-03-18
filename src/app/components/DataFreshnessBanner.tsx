/**
 * DataFreshnessBanner.tsx
 *
 * Shown above any component that displays potentially stale readings.
 * Computes staleness from the most recent calc_date across all passed stations.
 *
 * Thresholds:
 *   < 3h  → nothing rendered (null)
 *   3–12h → amber warning: "Data from Nh ago. Check again soon."
 *   > 12h → red warning:   "Data over Nh old. Recommendations may be outdated."
 *
 * Also exports:
 *   getDataAgeHours(stations) → number | null — hours since newest calc_date
 *   isDataTooOld(stations)    → boolean       — true when age > 12h
 *
 * These are used by ContextActivityPanel (F3.1) to suppress activity
 * recommendations when data is too stale to be actionable.
 *
 * Note: age thresholds (3h, 12h) are infrastructure constants — they live
 * here, not in aqi-config.ts.
 */

import type { StationSummary } from "@/lib/types";
import type { Lang } from "./LanguageSwitcher";

type Props = {
  stations: StationSummary[];
  lang: Lang;
};

// ─── Exported helpers ─────────────────────────────────────────────────────────

export function getDataAgeHours(stations: StationSummary[]): number | null {
  const timestamps = stations
    .map((s) => s.aqi.calc_date)
    .filter((d): d is string => Boolean(d))
    .map((d) => new Date(d).getTime())
    .filter((t) => !isNaN(t));

  if (timestamps.length === 0) return null;

  const newest = Math.max(...timestamps);
  return (Date.now() - newest) / 3_600_000;
}

export function isDataTooOld(stations: StationSummary[]): boolean {
  const age = getDataAgeHours(stations);
  return age !== null && age > 12;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DataFreshnessBanner({ stations, lang }: Props) {
  const age = getDataAgeHours(stations);

  // Return null for unknown age or fresh data (< 3h)
  if (age === null || age < 3) return null;

  const tooOld = age > 12;
  const h      = Math.floor(age);

  const bg     = tooOld ? "#FCEBEB" : "#FAEEDA";
  const border = tooOld ? "#F09595" : "#EF9F27";
  const color  = tooOld ? "#791F1F" : "#633806";

  const message = tooOld
    ? lang === "pl"
      ? `Dane mają ponad ${h}h. Zalecenia mogą być nieaktualne.`
      : `Data is over ${h}h old. Recommendations may be outdated.`
    : lang === "pl"
    ? `Dane sprzed ${h}h. Sprawdź ponownie za chwilę.`
    : `Data from ${h}h ago. Check again soon.`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "5px 10px",
        background: bg,
        border: `0.5px solid ${border}`,
        borderRadius: 6,
        fontSize: 11,
        color,
        marginBottom: 8,
      }}
    >
      {/* Clock icon */}
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
        <line
          x1="6" y1="3.5" x2="6" y2="6.5"
          stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
        />
        <circle cx="6" cy="8.5" r="0.7" fill="currentColor" />
      </svg>
      {message}
    </div>
  );
}
