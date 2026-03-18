/**
 * TodayStory.tsx
 *
 * Displays the "Today's Story" sentence above the map.
 * Fetches from /api/story/today on mount. Renders nothing while loading.
 *
 * The sentence colour is driven by the AQI level returned from the API.
 * If the story references a city name, that city becomes a navigation link
 * pointing to /?city={slug}.
 *
 * Replaces the old worst/median/best national summary strip (v2 F0.1).
 */
"use client";

import { useEffect, useState } from "react";
import { getLevelConfig } from "@/lib/aqi-config";
import { cityToSlug } from "@/lib/localData";
import type { AqiLevelKey } from "@/lib/aqi-config";
import type { Lang } from "./LanguageSwitcher";

type StoryData = {
  sentence_pl: string;
  sentence_en: string;
  level: AqiLevelKey;
  city: string | null;
};

type Props = { lang: Lang };

export default function TodayStory({ lang }: Props) {
  const [story, setStory] = useState<StoryData | null>(null);

  useEffect(() => {
    fetch("/api/story/today")
      .then((r) => r.json())
      .then((data: StoryData) => setStory(data))
      .catch(() => {});
  }, []);

  if (!story) return null;

  const cfg      = getLevelConfig(story.level);
  const sentence = lang === "pl" ? story.sentence_pl : story.sentence_en;

  // Wrap the city name in a navigation link if present
  let content: React.ReactNode = sentence;
  if (story.city && sentence.includes(story.city)) {
    const slug   = cityToSlug(story.city);
    const parts  = sentence.split(story.city);
    content = (
      <>
        {parts[0]}
        <a
          href={`/?city=${slug}`}
          style={{
            color: cfg.color.primary,
            textDecoration: "underline",
            textDecorationStyle: "dotted",
            cursor: "pointer",
          }}
        >
          {story.city}
        </a>
        {parts.slice(1).join(story.city)}
      </>
    );
  }

  return (
    <div
      style={{
        padding: "9px 20px",
        background: cfg.color.bg,
        borderBottom: `1.5px solid ${cfg.color.border}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexShrink: 0,
      }}
    >
      {/* Coloured dot indicator */}
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: cfg.color.primary,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: cfg.color.text,
          lineHeight: 1.5,
        }}
      >
        {content}
      </span>
    </div>
  );
}
