/**
 * WarningBanner.tsx
 * Sticky dismissible banner shown when AQI level is "zly" or "bardzo_zly".
 * Returns null for all other levels — never renders for good/moderate air.
 *
 * Dismissal persists for the browser session via sessionStorage.
 * Key includes levelKey so a worsening level (zly → bardzo_zly) shows the
 * banner again in the same session.
 *
 * Position: sticky top:0 so it stays visible as the panel scrolls.
 * z-index: 50 — below Leaflet layers (200+) but above normal content.
 * Must be "use client" — uses sessionStorage and useState.
 */
"use client";

import { useState } from "react";
import { getLevelConfig } from "@/lib/aqi-config";
import type { AqiLevelKey, AqiLevelConfig } from "@/lib/aqi-config";
import type { Lang } from "./LanguageSwitcher";

type Props = {
  levelKey: AqiLevelKey;
  lang: Lang;
};

const TRIGGER_LEVELS: AqiLevelKey[] = ["zly", "bardzo_zly"];

export default function WarningBanner({ levelKey, lang }: Props) {
  const storageKey = `powietrze_banner_dismissed_${levelKey}`;

  // Read dismissal state once on mount — sessionStorage is client-only so we
  // initialise from it directly (safe because this is a client component).
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(storageKey) === "1";
  });

  // Only render for zly and bardzo_zly
  if (!TRIGGER_LEVELS.includes(levelKey)) return null;
  if (dismissed) return null;

  // getLevelConfig always returns a full AqiLevelConfig for non-no_data keys
  const cfg = getLevelConfig(levelKey) as AqiLevelConfig;

  function dismiss() {
    sessionStorage.setItem(storageKey, "1");
    setDismissed(true);
  }

  return (
    <div
      role="alert"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: cfg.color.bg,
        borderBottom: `1.5px solid ${cfg.color.border}`,
        padding: "10px 16px",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      {/* Warning icon + text */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <svg
          width={16} height={16} viewBox="0 0 16 16" fill="none"
          style={{ flexShrink: 0, marginTop: 1 }}
          aria-hidden="true"
        >
          <path
            d="M8 1.5L14.5 13H1.5L8 1.5Z"
            stroke={cfg.color.text} strokeWidth="1.4"
            fill={cfg.color.bg}
          />
          <line x1="8" y1="6" x2="8" y2="9.5" stroke={cfg.color.text} strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="11.5" r="0.7" fill={cfg.color.text} />
        </svg>
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          color: cfg.color.text,
          lineHeight: 1.45,
        }}>
          {lang === "pl" ? cfg.copy.headline_pl : cfg.copy.headline_en}
        </span>
      </div>

      {/* Dismiss button */}
      <button
        onClick={dismiss}
        aria-label={lang === "pl" ? "Zamknij ostrzeżenie" : "Dismiss warning"}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: cfg.color.text,
          fontSize: 18,
          lineHeight: 1,
          padding: "0 2px",
          flexShrink: 0,
          opacity: 0.7,
        }}
      >
        ×
      </button>
    </div>
  );
}
