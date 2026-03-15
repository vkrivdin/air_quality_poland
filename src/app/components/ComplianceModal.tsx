/**
 * ComplianceModal.tsx
 * Full-screen overlay showing Kraków PM2.5 versus EU and WHO benchmarks.
 * Bar widths are proportional to BENCHMARKS.krakow_annual_pm25 (the denominator).
 * Closes on Escape, backdrop click, and × button.
 * All numeric values come from aqi-config — none hardcoded here.
 */
"use client";
import { useEffect } from "react";
import { BENCHMARKS, DISCLAIMER } from "@/lib/aqi-config";
import SourceBadge from "./SourceBadge";
import type { Lang } from "./LanguageSwitcher";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
};

type BenchmarkRow = {
  source: "gios" | "eu_directive" | "who";
  label_pl: string;
  label_en: string;
  value: number;
  valueLabel: string;
  desc_pl: string;
  desc_en: string;
  color: string;
};

const ROWS: BenchmarkRow[] = [
  {
    source: "gios",
    label_pl: "Kraków — średnia roczna PM2.5",
    label_en: "Kraków annual average PM2.5",
    value: BENCHMARKS.krakow_annual_pm25,
    valueLabel: `~${BENCHMARKS.krakow_annual_pm25} µg/m³`,
    desc_pl: "Najwyższe stężenia PM10 spośród 9 głównych miast Polski (2019–2024).",
    desc_en: "Highest PM10 concentrations among 9 major Polish cities (2019–2024).",
    color: "#E24B4A",
  },
  {
    source: "eu_directive",
    label_pl: `Obecny limit UE (Dyrektywa 2008/50/EC)`,
    label_en: "Current EU limit (Directive 2008/50/EC)",
    value: BENCHMARKS.eu_current_limit_pm25,
    valueLabel: `${BENCHMARKS.eu_current_limit_pm25} µg/m³`,
    desc_pl: "Kraków już teraz przekracza ten limit.",
    desc_en: "Kraków already exceeds this limit.",
    color: "#EF9F27",
  },
  {
    source: "eu_directive",
    label_pl: `Cel UE na ${BENCHMARKS.eu_2030_deadline_year} r. (Dyrektywa 2024/2881)`,
    label_en: `EU ${BENCHMARKS.eu_2030_deadline_year} target (Directive 2024/2881)`,
    value: BENCHMARKS.eu_2030_target_pm25,
    valueLabel: `${BENCHMARKS.eu_2030_target_pm25} µg/m³`,
    desc_pl: "Obywatele zyskują prawo do odszkodowania za szkody zdrowotne, jeśli norma nie zostanie dotrzymana.",
    desc_en: "Citizens gain the right to compensation for health damages if this target is missed.",
    color: "#639922",
  },
  {
    source: "who",
    label_pl: "Zalecenie WHO (2021)",
    label_en: "WHO guideline (2021)",
    value: BENCHMARKS.who_annual_pm25,
    valueLabel: `${BENCHMARKS.who_annual_pm25} µg/m³`,
    desc_pl: "Poziom, przy którym powietrze jest naprawdę bezpieczne. Kraków jest 6× powyżej tej wartości.",
    desc_en: "The level at which air is genuinely safe. Kraków is 6× above this value.",
    color: "#1D9E75",
  },
];

export default function ComplianceModal({ isOpen, onClose, lang }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxValue = BENCHMARKS.krakow_annual_pm25;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div style={{
        background: "var(--color-background-primary)",
        borderRadius: 12,
        border: "0.5px solid var(--color-border-secondary)",
        width: "100%", maxWidth: 440,
        maxHeight: "82vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "0.5px solid var(--color-border-tertiary)",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8,
        }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", lineHeight: 1.35 }}>
            {lang === "pl"
              ? "Kraków a normy jakości powietrza"
              : "Kraków and air quality standards"}
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--color-text-secondary)", fontSize: 18, lineHeight: 1,
            padding: "2px 4px", borderRadius: 4,
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px" }}>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--color-text-secondary)", marginBottom: 16 }}>
            {lang === "pl"
              ? "Kraków ma jeden z najgorszych wskaźników jakości powietrza w Polsce. Oto jak obecne stężenia wypadają na tle norm prawnych i zaleceń zdrowotnych."
              : "Kraków has one of the worst air quality records in Poland. Here is how current concentrations compare against legal limits and health guidelines."}
          </p>

          {/* Benchmark bars */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {ROWS.map((row, i) => (
              <div key={i} style={{
                background: "var(--color-background-secondary)",
                borderRadius: 8, padding: "10px 12px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", flex: 1 }}>
                    {lang === "pl" ? row.label_pl : row.label_en}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: row.color, whiteSpace: "nowrap" }}>
                    {row.valueLabel}
                  </span>
                </div>
                <div style={{ background: "var(--color-border-tertiary)", height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                  <div style={{
                    height: 6, borderRadius: 3,
                    width: `${Math.round((row.value / maxValue) * 100)}%`,
                    background: row.color,
                    transition: "width 0.6s ease",
                  }} />
                </div>
                <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  {lang === "pl" ? row.desc_pl : row.desc_en}
                </div>
                <div style={{ marginTop: 6 }}>
                  <SourceBadge source={row.source} lang={lang} />
                </div>
              </div>
            ))}
          </div>

          {/* Boiler fact */}
          <div style={{
            fontSize: 12.5, lineHeight: 1.65,
            background: "#FAEEDA", borderRadius: 8, padding: "10px 14px",
            marginBottom: 10,
          }}>
            <strong style={{ color: "#633806" }}>
              {lang === "pl"
                ? `~${BENCHMARKS.household_boiler_pm_share_pct}% pyłu zawieszonego w Polsce pochodzi z domowych kotłów i kominków`
                : `~${BENCHMARKS.household_boiler_pm_share_pct}% of particulate matter in Poland comes from household boilers and fireplaces`}
            </strong>
            {lang === "pl"
              ? " — nie z ruchu drogowego. Zakaz palenia węglem i drewnem w Krakowie obowiązuje od 2019 r."
              : " — not from traffic. Coal and wood burning in Kraków has been banned since 2019."}
          </div>

          {/* Disclaimer */}
          <div style={{
            fontSize: 11, color: "var(--color-text-tertiary)", lineHeight: 1.55,
            borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10,
          }}>
            {lang === "pl" ? DISCLAIMER.pl : DISCLAIMER.en}
          </div>
        </div>
      </div>
    </div>
  );
}
