/**
 * AqiDashboardCard.tsx
 * Full AQI decision card: headline copy, activity matrix, pollutant stats,
 * seasonal context messages, good-day percentile, compliance badge.
 * All copy and colour comes from aqi-config — nothing hardcoded.
 * Uses inline styles only (no Tailwind). "use client" not needed — no browser APIs.
 */
import { getLevelConfig, SEASONAL_RULES, GOOD_DAY_LEVELS, GOOD_DAY_MIN_DAYS } from "@/lib/aqi-config";
import type { AqiLevelKey, AqiLevelConfig } from "@/lib/aqi-config";
import ActivityMatrix from "./ActivityMatrix";
import AqiBadge from "./AqiBadge";
import ComplianceBadge from "./ComplianceBadge";
import type { Lang } from "./LanguageSwitcher";

type Props = {
  levelKey: AqiLevelKey;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  stationName: string;
  cityName: string;         // canonical display name, e.g. "Kraków", "Warszawa"
  updatedAt: string;        // ISO string — formatted inside the component
  lang: Lang;
  percentile?: number | null;   // % of days this year with worse air; null if < GOOD_DAY_MIN_DAYS days
  dataPointCount?: number;      // number of historical readings available
};

function formatUpdated(iso: string, lang: Lang): string {
  try {
    return new Date(iso).toLocaleString(lang === "pl" ? "pl-PL" : "en-GB", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AqiDashboardCard({
  levelKey, pm25, pm10, no2, stationName, cityName, updatedAt, lang,
  percentile = null, dataPointCount = 0,
}: Props) {
  const cfg = getLevelConfig(levelKey);
  const isNoData = levelKey === "no_data";
  // Narrowed config — only valid when !isNoData; has .copy and full fields
  const fullCfg = isNoData ? null : (cfg as AqiLevelConfig);
  const month = new Date().getMonth() + 1; // 1-indexed

  // Seasonal rules: collect all that apply
  const seasonalMessages = isNoData ? [] : SEASONAL_RULES
    .filter(r => r.condition(month, levelKey))
    .map(r => lang === "pl" ? r.message_pl : r.message_en);

  // Good day percentile — only when enough data AND level is good-or-better
  const showPercentile =
    !isNoData &&
    percentile !== null &&
    dataPointCount >= GOOD_DAY_MIN_DAYS &&
    (GOOD_DAY_LEVELS as AqiLevelKey[]).includes(levelKey);

  const stat = (label: string, value: number | null) => (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 500, color: "var(--color-text-primary)" }}>
        {value !== null ? value : "—"}
      </div>
      <div style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>µg/m³</div>
    </div>
  );

  return (
    <div style={{
      borderRadius: 12,
      border: `0.5px solid ${cfg.color.border}`,
      overflow: "hidden",
    }}>
      {/* Header band */}
      <div style={{ background: cfg.color.bg, padding: "14px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <AqiBadge levelKey={levelKey} showEnglish size="md" />
          {pm25 !== null && (
            <span style={{ fontSize: 13, color: cfg.color.text }}>
              PM2.5: <strong>{pm25}</strong> µg/m³
            </span>
          )}
        </div>
        <div style={{ fontSize: 18, fontWeight: 500, color: cfg.color.text, lineHeight: 1.35, marginBottom: 4 }}>
          {isNoData
            ? (lang === "pl" ? "Brak danych z czujników." : "No sensor data available.")
            : (lang === "pl" ? fullCfg!.copy.headline_pl : fullCfg!.copy.headline_en)}
        </div>
        {!isNoData && (
          <div style={{ fontSize: 13, color: cfg.color.text, opacity: 0.75 }}>
            {lang === "pl" ? fullCfg!.copy.headline_en : fullCfg!.copy.headline_pl}
          </div>
        )}
        {/* Activity matrix — only when not no_data */}
        {!isNoData && (
          <div style={{ marginTop: 12 }}>
            <ActivityMatrix levelKey={levelKey as Exclude<AqiLevelKey, "no_data">} lang={lang} />
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "14px 20px" }}>
        {/* Pollutant stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
          {stat("PM2.5", pm25)}
          {stat("PM10", pm10)}
          {stat("NO₂", no2)}
        </div>

        {/* Context note */}
        {!isNoData && (
          <div style={{
            fontSize: 12, lineHeight: 1.65, color: "var(--color-text-secondary)",
            background: "var(--color-background-secondary)", borderRadius: 8,
            padding: "8px 12px", marginBottom: seasonalMessages.length > 0 ? 8 : 12,
          }}>
            {lang === "pl" ? fullCfg!.copy.context_pl : fullCfg!.copy.context_en}
          </div>
        )}

        {/* Seasonal messages */}
        {seasonalMessages.map((msg, i) => (
          <div key={i} style={{
            fontSize: 12, lineHeight: 1.65, color: "var(--color-text-secondary)",
            borderLeft: `3px solid ${cfg.color.border}`,
            paddingLeft: 10, marginBottom: 8,
          }}>
            {msg}
          </div>
        ))}

        {/* Good day percentile */}
        {showPercentile && (
          <div style={{
            fontSize: 12, lineHeight: 1.65, color: "var(--color-text-secondary)",
            background: cfg.color.bg, borderRadius: 8, padding: "8px 12px", marginBottom: 12,
          }}>
            {lang === "pl"
              ? `Dziś powietrze jest czystsze niż w ${percentile}% dni tego roku w Krakowie.`
              : `Today's air is cleaner than ${percentile}% of days this year in Kraków.`}
          </div>
        )}

        {/* Meta row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
            {stationName} · {formatUpdated(updatedAt, lang)}
          </span>
          <ComplianceBadge lang={lang} cityName={cityName} />
        </div>
      </div>
    </div>
  );
}
