/**
 * AqiBadge.tsx
 * Reusable pill badge displaying an AQI level with colour from aqi-config.
 * Uses inline styles only (no Tailwind classes) per Phase 2+ convention.
 * Step 2.3: rewritten to use aqi-config colour system.
 */
"use client";
import { getLevelConfig, AQI_NO_DATA_CONFIG } from "@/lib/aqi-config";
import type { AqiLevelKey } from "@/lib/aqi-config";

type Props = {
  levelKey: AqiLevelKey | null | undefined;
  showEnglish?: boolean;
  size?: "sm" | "md" | "lg";
};

const SIZE_STYLES = {
  sm: { padding: "2px 8px",  fontSize: 11 },
  md: { padding: "4px 12px", fontSize: 12 },
  lg: { padding: "6px 14px", fontSize: 14 },
};

export default function AqiBadge({ levelKey, showEnglish = false, size = "md" }: Props) {
  const cfg = levelKey ? getLevelConfig(levelKey) : AQI_NO_DATA_CONFIG;
  const sz  = SIZE_STYLES[size];

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      borderRadius: 20,
      fontWeight: 500,
      border: `0.5px solid ${cfg.color.border}`,
      background: cfg.color.bg,
      color: cfg.color.text,
      padding: sz.padding,
      fontSize: sz.fontSize,
    }}>
      <span style={{
        width: 8, height: 8,
        borderRadius: "50%",
        background: cfg.color.primary,
        flexShrink: 0,
      }} />
      {cfg.label_pl}
      {showEnglish && (
        <span style={{ opacity: 0.65, fontWeight: 400, fontSize: sz.fontSize - 1 }}>
          ({cfg.label_en})
        </span>
      )}
    </span>
  );
}
