/**
 * ShareButton.tsx
 *
 * Copies the current URL (or a provided url prop) to the clipboard.
 * Shows a brief "Skopiowano / Copied" confirmation for 2 seconds.
 *
 * Used in: CityPanel header, StationCard header (F1.1), Timeline page (F5.3).
 *
 * Constraints:
 * - Uses navigator.clipboard.writeText only (no document.execCommand fallback)
 * - No native share sheet, no modal — clipboard copy only
 * - "Copied" state resets after exactly 2000ms
 */
"use client";

import { useState } from "react";
import type { Lang } from "./LanguageSwitcher";

type Props = {
  lang: Lang;
  /** URL to copy. Defaults to window.location.href when omitted. */
  url?: string;
};

export default function ShareButton({ lang, url }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const target = url ?? window.location.href;
    navigator.clipboard.writeText(target).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      title={lang === "pl" ? "Skopiuj link" : "Copy link"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        fontSize: 11,
        fontWeight: 500,
        border: `0.5px solid ${copied ? "#5DCAA5" : "var(--color-border-primary)"}`,
        borderRadius: 20,
        background: "transparent",
        color: copied ? "#0F6E56" : "var(--color-text-secondary)",
        cursor: "pointer",
        transition: "color 0.15s, border-color 0.15s",
        flexShrink: 0,
      }}
    >
      {copied ? (
        // Checkmark icon
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M2 6l3 3 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        // Copy icon
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M8 1H3a1 1 0 00-1 1v7"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <rect x="4" y="3" width="6" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      )}
      {copied
        ? lang === "pl" ? "Skopiowano" : "Copied"
        : lang === "pl" ? "Udostępnij" : "Share"}
    </button>
  );
}
