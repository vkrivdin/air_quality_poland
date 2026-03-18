/**
 * PageShell.tsx
 * Client component that owns language state and renders the full page layout.
 * Kept separate from page.tsx so the page can remain a Server Component
 * (required for searchParams access in Next.js App Router).
 *
 * Layout:
 *   Desktop (≥1024px): Navbar + two-column row (map 60% | focus panel 40%)
 *   Mobile:            Navbar + map (40vh) + focus panel (scrollable below)
 *
 * Map height fix (Step 4c):
 *   The map container is given an explicit CSS height via a className that
 *   sets height: 100% only when the parent has a defined height. We set the
 *   map column to an explicit height using a flex column with flex:1 and a
 *   min-height, with the inner div getting position:absolute + inset:0 so
 *   Leaflet always gets a concrete pixel size.
 */
"use client";

import { useLang } from "./LanguageSwitcher";
import Navbar from "./Navbar";
import MapWrapper from "./MapWrapper";
import CitySearch from "./CitySearch";
import CityPanel from "./CityPanel";
import { giosLabelToKey, AQI_LEVEL_CONFIGS, AQI_NO_DATA_CONFIG } from "@/lib/aqi-config";
import WarningBanner from "./WarningBanner";
import Footer from "./Footer";
import TodayStory from "./TodayStory";
import type { StationSummary, KrakowStation } from "@/lib/types";

type NationalSummary = {
  worst:  { city: string; pm25: number };
  median: { city: string; pm25: number };
  best:   { city: string; pm25: number };
};

type Props = {
  allStations:      StationSummary[];
  cityStations:     StationSummary[];      // stations for selected city (empty if no city)
  primarySummary:   StationSummary | null; // best Kraków station (null for other cities)
  primaryReadings:  KrakowStation | undefined;
  national:         NationalSummary | null;
  cityParam:        string | null;         // slug, e.g. "krakow", "warszawa"
  cityName:         string | null;         // canonical display name, e.g. "Kraków"
};

export default function PageShell({
  allStations, cityStations, primarySummary, primaryReadings,
  national, cityParam, cityName,
}: Props) {
  const [lang, setLang] = useLang();
  const showCity = cityParam !== null && cityStations.length > 0;

  // ── Legend counts ────────────────────────────────────────────────────────
  const levelCounts: Record<string, number> = {};
  for (const s of allStations) {
    const key = giosLabelToKey(s.aqi.level_name);
    levelCounts[key] = (levelCounts[key] ?? 0) + 1;
  }
  const noDataCount = levelCounts["no_data"] ?? 0;

  // ── Map stations — zoom to city if selected ──────────────────────────────
  const mapStations = showCity ? cityStations : allStations;
  const focusStationId =
    showCity && primarySummary ? primarySummary.id : undefined;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",           // explicit viewport height — fixes the tile rendering
      overflow: "hidden",
      background: "var(--color-background-tertiary)",
    }}>
      {/* ── Navbar ── */}
      <Navbar
        lang={lang}
        onLangChange={setLang}
        cityLabel={cityName ?? undefined}
        searchSlot={
          <CitySearch lang={lang} stations={allStations} />
        }
      />

      {/* ── Today's Story — replaces worst/median/best strip (v2 F0.1) ── */}
      <TodayStory lang={lang} />

      {/* ── Main area — flex:1, overflow hidden so children define their own scroll ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Map column — position:relative so the inner absolute div fills it exactly */}
        <div style={{
          position: "relative",
          flex: showCity ? "0 0 60%" : "1 1 100%",
        }}>
          {/* Absolutely-positioned inner div gives Leaflet a concrete pixel size */}
          <div style={{ position: "absolute", inset: 0 }}>
            <MapWrapper
              stations={mapStations}
              focusStationId={focusStationId}
              className="h-full w-full"
            />
          </div>

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
              {/* No-data row */}
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

          {/* Source badge */}
          <div style={{
            position: "absolute", bottom: 30, right: 8, zIndex: 400,
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
        </div>

        {/* Focus panel — only when a city is selected */}
        {showCity && (
          <div style={{
            flex: "0 0 40%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "var(--color-background-tertiary)",
            borderLeft: "0.5px solid var(--color-border-tertiary)",
          }}>
            {/* WarningBanner: sticky at top of panel; level derived from primary station */}
            <WarningBanner
              levelKey={giosLabelToKey(primarySummary?.aqi.level_name)}
              lang={lang}
            />
            <div style={{ flex: 1, overflowY: "auto" }}>
              <CityPanel
                cityName={cityName ?? cityParam ?? ""}
                citySlug={cityParam ?? ""}
                stations={cityStations}
                lang={lang}
                primarySummary={primarySummary ?? undefined}
                primaryReadings={primaryReadings}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ flexShrink: 0 }}>
        <Footer lang={lang} />
      </div>
    </div>
  );
}
