/**
 * PollutantChart.tsx
 * Recharts LineChart showing pollutant readings over time.
 *
 * Features:
 *  - Time range selector: 24h / 7d / 30d / 90d (client-side filter, default 24h)
 *  - WHO 24h reference line for PM2.5 only (value from BENCHMARKS — never hardcoded)
 *  - Neutral chart line colour (#5F5E5A) — never AQI level colours
 *  - Tooltip with date + value + unit
 *
 * Constraints:
 *  - Only BENCHMARKS.who_24h_pm25 is imported from aqi-config — no other benchmark values
 *  - No hardcoded numeric threshold values in this file
 */
"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { BENCHMARKS } from "@/lib/aqi-config";
import type { Lang } from "./LanguageSwitcher";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DataPoint = {
  date: string;  // ISO string e.g. "2026-03-15T11:00:00"
  value: number;
};

type Props = {
  data: DataPoint[];
  pollutant: "pm25" | "pm10" | "no2" | "o3" | "so2";
  lang: Lang;
};

// ─── Constants ────────────────────────────────────────────────────────────────

type RangeKey = "24h" | "7d" | "30d" | "90d";

const RANGE_HOURS: Record<RangeKey, number> = {
  "24h": 24,
  "7d":  24 * 7,
  "30d": 24 * 30,
  "90d": 24 * 90,
};

const POLLUTANT_LABELS: Record<Props["pollutant"], { pl: string; en: string; unit: string }> = {
  pm25: { pl: "PM2.5", en: "PM2.5", unit: "µg/m³" },
  pm10: { pl: "PM10",  en: "PM10",  unit: "µg/m³" },
  no2:  { pl: "NO₂",   en: "NO₂",   unit: "µg/m³" },
  o3:   { pl: "O₃",    en: "O₃",    unit: "µg/m³" },
  so2:  { pl: "SO₂",   en: "SO₂",   unit: "µg/m³" },
};

const LINE_COLOR = "#5F5E5A";
const GRID_COLOR = "var(--color-border-tertiary)";
const AXIS_COLOR = "var(--color-text-tertiary)";

// ─── Custom tooltip ───────────────────────────────────────────────────────────

type TooltipPayload = { value: number };
type CustomTooltipProps = {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  unit: string;
  lang: Lang;
};

function CustomTooltip({ active, payload, label, unit, lang }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const val = payload[0].value;
  const date = new Date(label);
  const dateLabel = date.toLocaleString(lang === "pl" ? "pl-PL" : "en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
  return (
    <div style={{
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-secondary)",
      borderRadius: 8,
      padding: "7px 11px",
      fontSize: 12,
      color: "var(--color-text-primary)",
      boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
    }}>
      <div style={{ color: "var(--color-text-secondary)", marginBottom: 2, fontSize: 11 }}>{dateLabel}</div>
      <div style={{ fontWeight: 500 }}>{val.toFixed(1)} {unit}</div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PollutantChart({ data, pollutant, lang }: Props) {
  const [range, setRange] = useState<RangeKey>("24h");

  const meta = POLLUTANT_LABELS[pollutant];

  // Filter data to selected time range
  const filtered = useMemo(() => {
    if (data.length === 0) return [];
    const cutoff = Date.now() - RANGE_HOURS[range] * 60 * 60 * 1000;
    const result = data.filter((d) => new Date(d.date).getTime() >= cutoff);
    // Fall back to all data if nothing in range (useful for demo/local data)
    return result.length > 0 ? result : data;
  }, [data, range]);

  // Format X axis tick based on range
  function formatTick(iso: string): string {
    const d = new Date(iso);
    if (range === "24h") {
      return d.toLocaleTimeString(lang === "pl" ? "pl-PL" : "en-GB", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString(lang === "pl" ? "pl-PL" : "en-GB", { day: "numeric", month: "short" });
  }

  const ranges: RangeKey[] = ["24h", "7d", "30d", "90d"];

  return (
    <div>
      {/* ── Header row: pollutant label + range selector ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
        gap: 8,
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)" }}>
          {meta[lang === "pl" ? "pl" : "en"]} ({meta.unit})
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: "3px 9px",
                fontSize: 11,
                fontWeight: range === r ? 600 : 400,
                borderRadius: 6,
                border: "0.5px solid",
                borderColor: range === r ? "var(--color-text-primary)" : "var(--color-border-secondary)",
                background: range === r ? "var(--color-text-primary)" : "transparent",
                color: range === r ? "var(--color-background-primary)" : "var(--color-text-secondary)",
                cursor: "pointer",
                transition: "all 0.12s",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart ── */}
      {filtered.length === 0 ? (
        <div style={{
          height: 240,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          color: "var(--color-text-tertiary)",
          background: "var(--color-background-secondary)",
          borderRadius: 8,
          border: "0.5px solid var(--color-border-tertiary)",
        }}>
          {lang === "pl" ? "Brak danych" : "No data"}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={filtered} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatTick}
              tick={{ fontSize: 10, fill: AXIS_COLOR }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: AXIS_COLOR }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              content={<CustomTooltip unit={meta.unit} lang={lang} />}
            />
            {/* WHO 24h reference line — PM2.5 only, value from BENCHMARKS */}
            {pollutant === "pm25" && (
              <ReferenceLine
                y={BENCHMARKS.who_24h_pm25}
                stroke="#854F0B"
                strokeDasharray="4 3"
                strokeWidth={1}
                label={{
                  value: "WHO",
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "#854F0B",
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={LINE_COLOR}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: LINE_COLOR }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
