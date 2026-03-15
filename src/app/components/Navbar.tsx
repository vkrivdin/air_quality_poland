/**
 * Navbar.tsx
 * App-wide navigation bar with Polish identity chrome.
 * White background, 3px #D4213D bottom border, flag icon, "P" accent, language switcher.
 * Background is always white — never dark, never changes with AQI level.
 *
 * Updated in Step 4c: accepts CitySearch via render-prop pattern so PageShell
 * can pass the already-loaded stations array down without re-fetching.
 */
"use client";
import PolishFlagIcon from "./PolishFlagIcon";
import LanguageSwitcher, { type Lang } from "./LanguageSwitcher";
import type { ReactNode } from "react";

type Props = {
  lang: Lang;
  onLangChange: (l: Lang) => void;
  cityLabel?: string;
  /** Optional search bar / controls rendered in the centre of the navbar */
  searchSlot?: ReactNode;
};

export default function Navbar({ lang, onLangChange, cityLabel, searchSlot }: Props) {
  return (
    <header style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
      height: 52,
      background: "var(--color-background-primary)",
      borderBottom: "3px solid #D4213D",
      flexShrink: 0,
      gap: 12,
    }}>
      {/* Left — logo + city breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <PolishFlagIcon width={24} height={16} />
        <a
          href="/"
          style={{
            fontSize: 16, fontWeight: 500,
            color: "var(--color-text-primary)",
            letterSpacing: "-0.01em",
            textDecoration: "none",
          }}
        >
          <span style={{ color: "#D4213D" }}>P</span>owietrze
        </a>
        {cityLabel && (
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            · {cityLabel}
          </span>
        )}
      </div>

      {/* Centre — search slot */}
      {searchSlot && (
        <div style={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0 }}>
          {searchSlot}
        </div>
      )}

      {/* Right — language switcher */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <LanguageSwitcher lang={lang} onChange={onLangChange} />
      </div>
    </header>
  );
}
