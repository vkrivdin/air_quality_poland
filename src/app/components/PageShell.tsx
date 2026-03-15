/**
 * PageShell.tsx
 * Client component that owns language state and renders the full page layout.
 * Kept separate from page.tsx so the page can remain a Server Component
 * (required for searchParams access in Next.js App Router).
 *
 * Layout:
 *   Desktop (≥1024px): Navbar + two-column row (map 60% | focus panel 40%)
 *   Mobile:            Navbar + map (40vh) + focus panel (scrollable below)
 */
"use client";

import { useLang } from "./LanguageSwitcher";
import Navbar from "./Navbar";
import MapWrapper from "./MapWrapper";
import AqiDashboardCard from "./AqiDashboardCard";
import { giosLabelToKey, getLevelConfig, AQI_LEVEL_CONFIGS, AQI_NO_DATA_CONFIG } from "@/lib/aqi-config";
import type { StationSummary, KrakowStation } from "@/lib/types";

type NationalSummary = {
  worst:  { city: string; pm25: number };
  median: { city: string; pm25: number };
  best:   { city: string; pm25: number };
};

type Props = {
  allStations:      StationSummary[];
  krakowStations:   StationSummary[];
  primarySummary:   StationSummary | null;
  primaryReadings:  KrakowStation | undefined;
  national:         NationalSummary | null;
  cityParam:        string | null;
};

export default function PageShell({
  allStations, krakowStations, primarySummary, primaryReadings, national, cityParam,
}: Props) {
  const [lang, setLang] = useLang();
  const showKrakow = cityParam === "krakow";

  // ── Legend data ────────────────────────────────────────────────────────────
  const levelCounts: Record<string, number> = {};
  for (const s of allStations) {
    const key = giosLabelToKey(s.aqi.level_name);
    levelCounts[key] = (levelCounts[key] ?? 0) + 1;
  }
  const noDataCount = levelCounts["no_data"] ?? 0;

  // ── Kraków dashboard data ──────────────────────────────────────────────────
  const krakowLevelKey = primarySummary
    ? giosLabelToKey(primarySummary.aqi.level_name)
    : "no_data" as const;
  const pm25Val = primaryReadings?.pollutants?.["PM2.5"]?.value ?? null;
  const pm10Val = primaryReadings?.pollutants?.["PM10"]?.value ?? null;
  const no2Val  = primaryReadings?.pollutants?.["NO2"]?.value ?? null;
  const updatedAt = primarySummary?.aqi.calc_date ?? new Date().toISOString();

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
      background: "var(--color-background-tertiary)",
    }}>
      <Navbar
        lang={lang}
        onLangChange={setLang}
        cityLabel={showKrakow ? "Kraków" : undefined}
      />

      {/* ── Main content ── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
      }}>

        {/* National summary strip — always visible */}
        {national && (
          <div style={{
            display: "flex",
            gap: 8,
            padding: "10px 16px",
            background: "var(--color-background-primary)",
            borderBottom: "0.5px solid var(--color-border-tertiary)",
            overflowX: "auto",
          }}>
            {[
              { label: lang === "pl" ? "Najgorsze" : "Worst",   data: national.worst,  color: "#A32D2D" },
              { label: lang === "pl" ? "Mediana"   : "Median",  data: national.median, color: "#854F0B" },
              { label: lang === "pl" ? "Najlepsze" : "Best",    data: national.best,   color: "#0F6E56" },
            ].map(({ label, data, color }) => (
              <div key={label} style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "var(--color-background-secondary)",
                borderRadius: 8, padding: "6px 12px",
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 10, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                  {label}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color, whiteSpace: "nowrap" }}>
                  {data.city}
                </span>
                <span style={{ fontSize: 11, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                  {data.pm25} µg/m³
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Desktop: two-column / Mobile: stacked ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

          {/* Map + optional focus panel */}
          <div style={{
            flex: 1,
            display: "flex",
            // On small screens this stays column; CSS media query handles desktop
          }}>
            {/* Map column */}
            <div style={{
              position: "relative",
              flex: showKrakow ? "0 0 60%" : "1",
              minHeight: "40vh",
            }}
              className={showKrakow ? "powietrze-map-col" : "powietrze-map-full"}
            >
              <MapWrapper
                stations={showKrakow ? krakowStations : allStations}
                focusStationId={showKrakow && primarySummary ? primarySummary.id : undefined}
                className="h-full w-full"
              />

              {/* Legend overlay */}
              <div style={{
                position: "absolute", top: 12, left: 48, zIndex: 400,
                background: "var(--color-background-primary)",
                border: "0.5px solid var(--color-border-secondary)",
                borderRadius: 10, padding: "10px 14px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  color: "var(--color-text-secondary)", marginBottom: 6,
                }}>
                  {lang === "pl" ? "Indeks AQI" : "AQI Index"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {Object.values(AQI_LEVEL_CONFIGS).map((cfg) => (
                    <div key={cfg.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color.primary, flexShrink: 0, display: "inline-block" }} />
                        <span style={{ fontSize: 11, color: "var(--color-text-primary)" }}>{cfg.label_pl}</span>
                      </div>
                      <span style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>
                        {levelCounts[cfg.key] ?? 0}
                      </span>
                    </div>
                  ))}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: AQI_NO_DATA_CONFIG.color.primary, flexShrink: 0, display: "inline-block" }} />
                      <span style={{ fontSize: 11, color: "var(--color-text-primary)" }}>
                        {lang === "pl" ? "Brak danych" : "No data"}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>{noDataCount}</span>
                  </div>
                </div>
              </div>

              {/* Source badge overlay */}
              <div style={{
                position: "absolute", bottom: 12, right: 8, zIndex: 400,
                background: "var(--color-background-primary)",
                border: "0.5px solid var(--color-border-secondary)",
                borderRadius: 8, padding: "5px 10px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
              }}>
                <span style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>
                  {lang === "pl" ? "Źródło" : "Source"}:{" "}
                  <a
                    href="https://powietrze.gios.gov.pl"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#D4213D", textDecoration: "none" }}
                  >
                    GIOŚ
                  </a>
                </span>
              </div>

              {/* Kraków focus link — only when not already focused */}
              {!showKrakow && (
                <div style={{
                  position: "absolute", bottom: 12, left: 48, zIndex: 400,
                }}>
                  <a
                    href="/?city=krakow"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "var(--color-background-primary)",
                      border: "0.5px solid var(--color-border-secondary)",
                      borderRadius: 8, padding: "5px 12px",
                      fontSize: 11, fontWeight: 500,
                      color: "var(--color-text-primary)",
                      textDecoration: "none",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                    }}
                  >
                    Kraków →
                  </a>
                </div>
              )}
            </div>

            {/* Focus panel — only when city is selected */}
            {showKrakow && primarySummary && (
              <div
                className="powietrze-focus-panel"
                style={{
                  flex: "0 0 40%",
                  overflowY: "auto",
                  padding: 16,
                  background: "var(--color-background-tertiary)",
                  borderLeft: "0.5px solid var(--color-border-tertiary)",
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <a
                    href="/"
                    style={{
                      fontSize: 12, color: "var(--color-text-secondary)",
                      textDecoration: "none",
                    }}
                  >
                    ← {lang === "pl" ? "Mapa Polski" : "Poland map"}
                  </a>
                </div>
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
          </div>
        </div>

        {/* Footer */}
        <footer style={{
          borderTop: "0.5px solid var(--color-border-tertiary)",
          padding: "10px 16px",
          background: "var(--color-background-primary)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}>
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
            {lang === "pl"
              ? `Dane: GIOŚ · ${allStations.length} stacji w Polsce`
              : `Data: GIOŚ · ${allStations.length} stations in Poland`}
          </span>
          <a
            href="https://www.perplexity.ai/computer"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: "var(--color-text-tertiary)", textDecoration: "none" }}
          >
            Created with Perplexity Computer
          </a>
        </footer>
      </div>
    </div>
  );
}
