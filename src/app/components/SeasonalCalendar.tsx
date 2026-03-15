/**
 * SeasonalCalendar.tsx
 * D3-powered calendar heatmap showing daily average PM2.5 levels.
 *
 * Each cell = one day, coloured by AQI level derived from PM2.5.
 * Layout: weeks as columns (Mon–Sun rows), month labels along the top.
 *
 * Data contract:
 *   DayReading.date  — "YYYY-MM-DD"
 *   DayReading.avgPm25 — daily average PM2.5 µg/m³, or null if no data
 *
 * Renders a placeholder when readings.length < 7 (not enough to draw a grid).
 * Horizontal scroll on mobile is intentional.
 */
"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { pm25ToLevelKey, getLevelConfig } from "@/lib/aqi-config";
import type { AqiLevelConfig } from "@/lib/aqi-config";
import type { Lang } from "./LanguageSwitcher";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DayReading = {
  date: string;      // "YYYY-MM-DD"
  avgPm25: number | null;
};

type Props = {
  readings: DayReading[];
  lang: Lang;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const CELL      = 11;   // cell size px (desktop)
const CELL_GAP  = 2;    // gap between cells
const STEP      = CELL + CELL_GAP;
const DAY_LABELS_WIDTH = 24;  // left margin for Mon/Wed/Fri labels
const MONTH_LABEL_HEIGHT = 20;
const NO_DATA_COLOR = "#D3D1C7";

const DAY_NAMES_PL = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];
const DAY_NAMES_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MONTH_NAMES_PL = ["sty","lut","mar","kwi","maj","cze","lip","sie","wrz","paź","lis","gru"];
const MONTH_NAMES_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Parse "YYYY-MM-DD" without timezone shift */
function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** ISO week day: Mon = 0, Sun = 6 */
function isoWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Get cell colour for a day reading */
function cellColor(avgPm25: number | null): string {
  if (avgPm25 === null) return NO_DATA_COLOR;
  const key = pm25ToLevelKey(avgPm25);
  return getLevelConfig(key).color.primary;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SeasonalCalendar({ readings, lang }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  // ── Placeholder ────────────────────────────────────────────────────────────
  if (readings.length < 7) {
    return (
      <div style={{
        padding: "20px 16px",
        fontSize: 13,
        color: "var(--color-text-secondary)",
        background: "var(--color-background-secondary)",
        borderRadius: 10,
        border: "0.5px solid var(--color-border-secondary)",
        textAlign: "center",
      }}>
        {lang === "pl"
          ? "Kalendarz będzie dostępny po zebraniu pierwszych danych."
          : "Calendar will be available once data has been collected."}
      </div>
    );
  }

  // ── D3 render ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!svgRef.current || readings.length < 7) return;

    // Build a map of date string → reading
    const byDate = new Map<string, DayReading>();
    for (const r of readings) byDate.set(r.date, r);

    // Determine date range: first reading → last reading
    const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = parseDate(sorted[0].date);
    const lastDate  = parseDate(sorted[sorted.length - 1].date);

    // Extend firstDate back to Monday of its week
    const startDate = new Date(firstDate);
    startDate.setDate(startDate.getDate() - isoWeekday(startDate));

    // Extend lastDate forward to Sunday of its week
    const endDate = new Date(lastDate);
    endDate.setDate(endDate.getDate() + (6 - isoWeekday(endDate)));

    // Build all days in range
    const days: Date[] = [];
    const cur = new Date(startDate);
    while (cur <= endDate) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }

    // Number of weeks (columns)
    const numWeeks = days.length / 7;
    const svgW = DAY_LABELS_WIDTH + numWeeks * STEP;
    const svgH = MONTH_LABEL_HEIGHT + 7 * STEP;

    // Clear previous render
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width",  svgW)
      .attr("height", svgH);

    const g = svg.append("g")
      .attr("transform", `translate(${DAY_LABELS_WIDTH},${MONTH_LABEL_HEIGHT})`);

    // ── Day labels (Mon / Wed / Fri only to avoid crowding) ──────────────────
    const dayNames = lang === "pl" ? DAY_NAMES_PL : DAY_NAMES_EN;
    [0, 2, 4].forEach((dow) => {
      svg.append("text")
        .attr("x", DAY_LABELS_WIDTH - 4)
        .attr("y", MONTH_LABEL_HEIGHT + dow * STEP + CELL - 1)
        .attr("text-anchor", "end")
        .attr("font-size", 9)
        .attr("fill", "var(--color-text-tertiary)")
        .text(dayNames[dow]);
    });

    // ── Month labels ─────────────────────────────────────────────────────────
    const monthNames = lang === "pl" ? MONTH_NAMES_PL : MONTH_NAMES_EN;
    let lastMonth = -1;
    days.forEach((d) => {
      if (isoWeekday(d) === 0 && d.getMonth() !== lastMonth) {
        const week = Math.floor(
          (d.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
        );
        svg.append("text")
          .attr("x", DAY_LABELS_WIDTH + week * STEP)
          .attr("y", MONTH_LABEL_HEIGHT - 4)
          .attr("font-size", 9)
          .attr("fill", "var(--color-text-secondary)")
          .text(monthNames[d.getMonth()]);
        lastMonth = d.getMonth();
      }
    });

    // ── Tooltip ──────────────────────────────────────────────────────────────
    const tooltip = d3
      .select("body")
      .append("div")
      .style("position",   "fixed")
      .style("background", "var(--color-background-primary)")
      .style("border",     "0.5px solid var(--color-border-secondary)")
      .style("border-radius", "8px")
      .style("padding",    "7px 11px")
      .style("font-size",  "12px")
      .style("color",      "var(--color-text-primary)")
      .style("box-shadow", "0 4px 16px rgba(0,0,0,0.10)")
      .style("pointer-events", "none")
      .style("opacity",    "0")
      .style("z-index",    "9999")
      .style("transition", "opacity 0.1s");

    // ── Day cells ────────────────────────────────────────────────────────────
    days.forEach((d) => {
      const dow  = isoWeekday(d);
      const week = Math.floor(
        (d.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
      );
      const dateStr = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");

      const reading = byDate.get(dateStr) ?? null;
      const color   = reading ? cellColor(reading.avgPm25) : NO_DATA_COLOR;

      const rect = g
        .append("rect")
        .attr("x",      week * STEP)
        .attr("y",      dow  * STEP)
        .attr("width",  CELL)
        .attr("height", CELL)
        .attr("rx",     2)
        .attr("ry",     2)
        .attr("fill",   color)
        .style("cursor", reading ? "pointer" : "default");

      // Tooltip interactions
      rect
        .on("mouseenter", (event: MouseEvent) => {
          if (!reading) return;
          const locale = lang === "pl" ? "pl-PL" : "en-GB";
          const dateLabel = d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
          const pm25Val   = reading.avgPm25 !== null ? `${reading.avgPm25.toFixed(1)} µg/m³` : (lang === "pl" ? "brak danych" : "no data");
          let levelLabel  = "";
          if (reading.avgPm25 !== null) {
            const key = pm25ToLevelKey(reading.avgPm25);
            const cfg = getLevelConfig(key) as AqiLevelConfig;
            levelLabel = lang === "pl" ? cfg.label_pl : cfg.label_en;
          }
          tooltip
            .html(`<strong>${dateLabel}</strong><br/>${levelLabel ? levelLabel + " · " : ""}${pm25Val}`)
            .style("opacity", "1")
            .style("left",  `${event.clientX + 12}px`)
            .style("top",   `${event.clientY - 36}px`);
        })
        .on("mousemove", (event: MouseEvent) => {
          tooltip
            .style("left", `${event.clientX + 12}px`)
            .style("top",  `${event.clientY - 36}px`);
        })
        .on("mouseleave", () => {
          tooltip.style("opacity", "0");
        });
    });

    return () => {
      tooltip.remove();
    };
  }, [readings, lang]);

  return (
    <div style={{ overflowX: "auto" }}>
      <svg ref={svgRef} style={{ display: "block" }} />
    </div>
  );
}
