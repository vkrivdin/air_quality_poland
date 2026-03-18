/**
 * src/app/api/story/today/route.ts
 *
 * GET /api/story/today
 *
 * Computes one "Today's Story" sentence from the latest readings in local.db.
 * Falls back gracefully when the DB is unavailable or empty.
 *
 * Rules (evaluated in order — first match wins):
 *   1. Any city has AQI = "bardzo_zly"  → smog alarm sentence
 *   2. Best city is "bardzo_dobry" while national median ≥ "umiarkowany" → standout clean
 *   3. Worst city is "zly"              → high pollution warning
 *   4. >60% of cities are good          → good day sentence
 *   5. Fallback: count summary
 *
 * Returns: { sentence_pl, sentence_en, level: AqiLevelKey, city: string | null }
 * Level drives the sentence colour in TodayStory component.
 *
 * Revalidated at most once per hour (revalidate = 3600).
 * Returns graceful fallback when data/local.db does not exist.
 */

import { NextResponse } from "next/server";
import { giosLabelToKey } from "@/lib/aqi-config";
import type { AqiLevelKey } from "@/lib/aqi-config";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const DB_PATH = path.resolve(process.cwd(), "data/local.db");

type StoryResult = {
  sentence_pl: string;
  sentence_en: string;
  level: AqiLevelKey;
  city: string | null;
};

const FALLBACK: StoryResult = {
  sentence_pl: "Dane są chwilowo niedostępne.",
  sentence_en: "Data is temporarily unavailable.",
  level: "no_data",
  city: null,
};

/** Truncates a string at the last word boundary before maxLen chars. */
function truncate(s: string, maxLen = 100): string {
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}

const LEVEL_SCORE: Record<AqiLevelKey, number> = {
  no_data: 0,
  bardzo_dobry: 1,
  dobry: 2,
  umiarkowany: 3,
  zly: 4,
  bardzo_zly: 5,
};

export async function GET(): Promise<NextResponse> {
  // Graceful fallback when DB doesn't exist (JSON snapshot mode)
  if (!fs.existsSync(DB_PATH)) {
    return NextResponse.json(FALLBACK);
  }

  try {
    // Dynamic import so this module doesn't crash when better-sqlite3 is
    // unavailable in environments that don't support native modules.
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(DB_PATH, { readonly: true });

    // Latest readings in the past 3 hours
    const cutoff = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    const rows = db
      .prepare(
        `SELECT s.city, r.aqi_level, r.pm25, r.measured_at
         FROM readings r
         JOIN stations s ON r.station_id = s.id
         WHERE r.measured_at >= ?
         ORDER BY r.measured_at DESC`
      )
      .all(cutoff) as Array<{
        city: string;
        aqi_level: string | null;
        pm25: number | null;
        measured_at: string;
      }>;

    db.close();

    if (rows.length === 0) {
      // No recent data — try last 24h before giving up
      const db2 = new Database(DB_PATH, { readonly: true });
      const cutoff24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const rows24 = db2
        .prepare(
          `SELECT s.city, r.aqi_level, r.pm25, r.measured_at
           FROM readings r
           JOIN stations s ON r.station_id = s.id
           WHERE r.measured_at >= ?
           ORDER BY r.measured_at DESC`
        )
        .all(cutoff24) as typeof rows;
      db2.close();
      if (rows24.length === 0) return NextResponse.json(FALLBACK);
      return buildStory(rows24);
    }

    return buildStory(rows);
  } catch {
    return NextResponse.json(FALLBACK);
  }
}

function buildStory(
  rows: Array<{ city: string; aqi_level: string | null; pm25: number | null }>
): NextResponse {
  // Aggregate: worst level per city
  const byCity = new Map<string, { level: AqiLevelKey; pm25: number }>();
  for (const r of rows) {
    const key = giosLabelToKey(r.aqi_level);
    const existing = byCity.get(r.city);
    if (!existing || LEVEL_SCORE[key] > LEVEL_SCORE[existing.level]) {
      byCity.set(r.city, { level: key, pm25: r.pm25 ?? 0 });
    }
  }

  const cities = Array.from(byCity.entries()).map(([city, d]) => ({
    city,
    ...d,
  }));
  const sorted = [...cities].sort(
    (a, b) => LEVEL_SCORE[b.level] - LEVEL_SCORE[a.level]
  );

  const worst = sorted[0];
  const best  = sorted[sorted.length - 1];

  const nationalScores = cities.map((c) => LEVEL_SCORE[c.level]);
  const sortedScores   = [...nationalScores].sort((a, b) => a - b);
  const medianScore    = sortedScores[Math.floor(sortedScores.length / 2)] ?? 0;

  const WHO_ANNUAL = 5; // µg/m³ WHO annual PM2.5 guideline

  // Rule 1: smog alarm
  if (worst?.level === "bardzo_zly") {
    const x = Math.max(1, Math.round((worst.pm25 ?? 0) / WHO_ANNUAL));
    const result: StoryResult = {
      sentence_pl: truncate(
        `Alarm smogowy w ${worst.city}. PM2.5 przekracza normę WHO ${x}-krotnie.`
      ),
      sentence_en: truncate(
        `Smog alert in ${worst.city}. PM2.5 is ${x}× above the WHO guideline.`
      ),
      level: "bardzo_zly",
      city: worst.city,
    };
    return NextResponse.json(result);
  }

  // Rule 2: unusually clean standout city
  if (best?.level === "bardzo_dobry" && medianScore >= LEVEL_SCORE.umiarkowany) {
    const result: StoryResult = {
      sentence_pl: truncate(
        `${best.city} ma dziś wyjątkowo czyste powietrze — jeden z niewielu jasnych punktów.`
      ),
      sentence_en: truncate(
        `${best.city} has exceptionally clean air today — one of few bright spots.`
      ),
      level: "bardzo_dobry",
      city: best.city,
    };
    return NextResponse.json(result);
  }

  // Rule 3: elevated pollution
  if (worst?.level === "zly") {
    const result: StoryResult = {
      sentence_pl: truncate(
        `Wysokie stężenia smogu w ${worst.city}. Ogranicz aktywność na zewnątrz.`
      ),
      sentence_en: truncate(
        `High smog levels in ${worst.city}. Limit outdoor activity today.`
      ),
      level: "zly",
      city: worst.city,
    };
    return NextResponse.json(result);
  }

  // Rule 4: mostly good day
  const goodCount = cities.filter((c) =>
    ["bardzo_dobry", "dobry"].includes(c.level)
  ).length;
  if (goodCount > cities.length * 0.6) {
    const result: StoryResult = {
      sentence_pl: "Dobry dzień na aktywność w Polsce. Większość miast — czyste powietrze.",
      sentence_en: "A good day for outdoor activity across Poland. Most cities — clean air.",
      level: "dobry",
      city: null,
    };
    return NextResponse.json(result);
  }

  // Rule 5: fallback count summary
  const badCount = cities.filter((c) =>
    ["zly", "bardzo_zly"].includes(c.level)
  ).length;
  const result: StoryResult = {
    sentence_pl: truncate(
      `Polska dziś: ${goodCount} miast z dobrym powietrzem, ${badCount} z przekroczeniami.`
    ),
    sentence_en: truncate(
      `Poland today: ${goodCount} cities with clean air, ${badCount} with exceedances.`
    ),
    level: "umiarkowany",
    city: null,
  };
  return NextResponse.json(result);
}
