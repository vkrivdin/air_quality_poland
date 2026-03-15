"use client";

/**
 * AqiBadge.tsx
 * Reusable AQI level pill/badge component.
 * Renders a colored badge with the Polish and English AQI level name.
 */

import { getAqiMeta } from "@/lib/types";

type Props = {
  levelName: string | null | undefined;
  showEnglish?: boolean;
  size?: "sm" | "md" | "lg";
};

export default function AqiBadge({ levelName, showEnglish = false, size = "md" }: Props) {
  const meta = getAqiMeta(levelName);

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base font-semibold",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        background: `${meta.color}22`,
        border: `1px solid ${meta.color}88`,
        color: meta.color,
      }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: meta.color }}
      />
      {meta.label_pl}
      {showEnglish && (
        <span className="opacity-60 font-normal text-xs">({meta.label_en})</span>
      )}
    </span>
  );
}
