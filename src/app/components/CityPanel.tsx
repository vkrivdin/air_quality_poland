/**
 * CityPanel.tsx
 * Focus panel shown when a city is selected via /?city=<slug>.
 *
 * Layout:
 *  - Back link ("← Mapa Polski")
 *  - City heading + station count
 *  - For Kraków: AqiDashboardCard rendered above the station list
 *  - Station list: each row shows station name, AQI badge, individual pollutant levels
 *
 * Uses inline styles only (Phase 2+ convention). No Tailwind classes.
 */
"use client";

import AqiBadge from "./AqiBadge";
import AqiDashboardCard from "./AqiDashboardCard";
import { giosLabelToKey, getLevelConfig, AQI_LEVEL_CONFIGS } from "@/lib/aqi-config";
import type { AqiLevelKey, AqiLevelConfig } from "@/lib/aqi-config";
import type { StationSummary, KrakowStation } from "@/lib/types";
import type { Lang } from "./LanguageSwitcher";

// ─── CitySummaryCard ──────────────────────────────────────────────────────────
// Lightweight summary for non-Kraków cities. Works from StationSummary[] alone
// — no hourly readings required. Shows dominant level, station breakdown,
// best/worst station names, and data timestamp.

type CitySummaryCardProps = {
  stations: StationSummary[];
  lang: Lang;
};

function CitySummaryCard({ stations, lang }: CitySummaryCardProps) {
  // Count stations per level key
  const counts: Partial<Record<AqiLevelKey, number>> = {};
  for (const s of stations) {
    const k = giosLabelToKey(s.aqi.level_name);
    counts[k] = (counts[k] ?? 0) + 1;
  }

  // Dominant level = most common non-no_data level; fall back to no_data
  const dominantKey = (Object.keys(AQI_LEVEL_CONFIGS) as AqiLevelKey[])
    .reduce<AqiLevelKey | null>((best, key) => {
      if (key === "no_data") return best;
      if ((counts[key] ?? 0) > (best ? (counts[best] ?? 0) : 0)) return key;
      return best;
    }, null) ?? "no_data";

  const cfg = getLevelConfig(dominantKey) as AqiLevelConfig;

  // Best / worst station by aqi.score (lower = better)
  const withScore = stations.filter(s => s.aqi.score !== null) as (StationSummary & { aqi: { score: number } })[];
  withScore.sort((a, b) => a.aqi.score - b.aqi.score);
  const bestStation  = withScore[0];
  const worstStation = withScore[withScore.length - 1];

  // Most recent calc_date across all stations
  const latestDate = stations
    .map(s => s.aqi.calc_date)
    .filter(Boolean)
    .sort()
    .at(-1);

  const dateStr = latestDate
    ? new Date(latestDate).toLocaleString(lang === "pl" ? "pl-PL" : "en-GB", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : null;

  // Station count breakdown label — e.g. "5 Dobry · 4 Brak danych"
  const breakdownParts = (Object.entries(counts) as [AqiLevelKey, number][])
    .sort(([a], [b]) => {
      const order: AqiLevelKey[] = ["bardzo_dobry", "dobry", "umiarkowany", "zly", "bardzo_zly", "no_data"];
      return order.indexOf(a) - order.indexOf(b);
    })
    .map(([key, count]) => {
      const levelCfg = getLevelConfig(key) as AqiLevelConfig;
      return `${count}\u00a0${lang === "pl" ? levelCfg.label_pl : levelCfg.label_en}`;
    });

  return (
    <div style={{
      borderRadius: 12,
      border: `0.5px solid ${cfg.color.border}`,
      overflow: "hidden",
      marginBottom: 16,
    }}>
      {/* Coloured header band — same visual weight as AqiDashboardCard */}
      <div style={{ background: cfg.color.bg, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <AqiBadge levelKey={dominantKey} showEnglish size="md" />
          <span style={{ fontSize: 12, color: cfg.color.text, opacity: 0.8 }}>
            {lang === "pl" ? "Dominujący poziom" : "Dominant level"}
          </span>
        </div>
        {/* Level breakdown chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {breakdownParts.map((part, i) => (
            <span key={i} style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 20,
              background: "rgba(255,255,255,0.55)",
              color: cfg.color.text,
              border: `0.5px solid ${cfg.color.border}`,
            }}>
              {part}
            </span>
          ))}
        </div>
      </div>

      {/* Body — best / worst / timestamp */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {bestStation && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {lang === "pl" ? "Najlepsza stacja" : "Best station"}
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", textAlign: "right", maxWidth: "60%" }}>
              {bestStation.name}
            </span>
          </div>
        )}
        {worstStation && worstStation.id !== bestStation?.id && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {lang === "pl" ? "Najgorsza stacja" : "Worst station"}
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", textAlign: "right", maxWidth: "60%" }}>
              {worstStation.name}
            </span>
          </div>
        )}
        {dateStr && (
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 8, marginTop: 2 }}>
            {lang === "pl" ? "Dane: GIOŚ · " : "Data: GIOŚ · "}{dateStr}
          </div>
        )}
      </div>
    </div>
  );
}

type Props = {
  cityName: string;
  citySlug: string;
  stations: StationSummary[];
  lang: Lang;
  // Kraków-only extras (undefined for other cities)
  primarySummary?: StationSummary | null;
  primaryReadings?: KrakowStation;
};

export default function CityPanel({
  cityName,
  citySlug,
  stations,
  lang,
  primarySummary,
  primaryReadings,
}: Props) {
  const isKrakow = citySlug === "krakow";

  // Kraków dashboard card data
  const krakowLevelKey = primarySummary
    ? giosLabelToKey(primarySummary.aqi.level_name)
    : ("no_data" as const);
  const pm25Val = primaryReadings?.pollutants?.["PM2.5"]?.value ?? null;
  const pm10Val = primaryReadings?.pollutants?.["PM10"]?.value ?? null;
  const no2Val  = primaryReadings?.pollutants?.["NO2"]?.value ?? null;
  const updatedAt = primarySummary?.aqi.calc_date ?? new Date().toISOString();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ── Header ── */}
      <div style={{
        padding: "12px 16px 10px",
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        flexShrink: 0,
      }}>
        <a
          href="/"
          style={{
            fontSize: 12,
            color: "var(--color-text-secondary)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 8,
          }}
        >
          ← {lang === "pl" ? "Mapa Polski" : "Poland map"}
        </a>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <h2 style={{
            fontSize: 18,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            margin: 0,
          }}>
            {cityName}
          </h2>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            {stations.length} {lang === "pl"
              ? stations.length === 1 ? "stacja" : stations.length < 5 ? "stacje" : "stacji"
              : stations.length === 1 ? "station" : "stations"}
          </span>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

        {/* Kraków: full AqiDashboardCard with hourly data */}
        {isKrakow && primarySummary && (
          <div style={{ marginBottom: 16 }}>
            <AqiDashboardCard
              levelKey={krakowLevelKey}
              pm25={pm25Val}
              pm10={pm10Val}
              no2={no2Val}
              stationName={primarySummary.name}
              updatedAt={updatedAt}
              lang={lang}
            />
          </div>
        )}

        {/* ── Station list ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Non-Kraków: lightweight summary card derived from StationSummary[] */}
          {!isKrakow && (
            <CitySummaryCard stations={stations} lang={lang} />
          )}

          {/* For Kraków, show "Other stations" header when there's more than 1 */}
          {isKrakow && stations.length > 1 && (
            <div style={{
              fontSize: 10, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.08em",
              color: "var(--color-text-tertiary)",
              marginBottom: 4,
            }}>
              {lang === "pl" ? "Pozostałe stacje" : "Other stations"}
            </div>
          )}

          {stations.map((s) => {
            // For Kraków, skip the primary station (it's already shown in the card above)
            if (isKrakow && primarySummary && s.id === primarySummary.id) return null;

            const levelKey = giosLabelToKey(s.aqi.level_name);
            const pollutants = [
              s.aqi.pm25_level && { label: "PM2.5", val: s.aqi.pm25_level },
              s.aqi.pm10_level && { label: "PM10",  val: s.aqi.pm10_level },
              s.aqi.no2_level  && { label: "NO₂",   val: s.aqi.no2_level },
              s.aqi.o3_level   && { label: "O₃",    val: s.aqi.o3_level },
            ].filter(Boolean) as Array<{ label: string; val: string }>;

            const timeStr = s.aqi.calc_date
              ? new Date(s.aqi.calc_date).toLocaleTimeString("pl", { hour: "2-digit", minute: "2-digit" })
              : null;

            return (
              <div
                key={s.id}
                style={{
                  background: "var(--color-background-primary)",
                  border: "0.5px solid var(--color-border-secondary)",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                {/* Station name row */}
                <div style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 6,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", lineHeight: 1.3 }}>
                      {s.name}
                    </div>
                    {s.street && (
                      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 1 }}>
                        {s.street}
                      </div>
                    )}
                  </div>
                  <AqiBadge levelKey={levelKey} size="sm" />
                </div>

                {/* Pollutant chips */}
                {pollutants.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {pollutants.map(({ label, val }) => (
                      <span
                        key={label}
                        style={{
                          fontSize: 10,
                          padding: "2px 7px",
                          borderRadius: 6,
                          background: "var(--color-background-secondary)",
                          color: "var(--color-text-secondary)",
                          border: "0.5px solid var(--color-border-tertiary)",
                        }}
                      >
                        {label}: {val}
                      </span>
                    ))}
                    {timeStr && (
                      <span style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginLeft: "auto", alignSelf: "center" }}>
                        {timeStr}
                      </span>
                    )}
                  </div>
                )}

                {pollutants.length === 0 && (
                  <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                    {lang === "pl" ? "Brak danych cząstkowych" : "No partial data"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
