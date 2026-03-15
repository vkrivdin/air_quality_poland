/**
 * Navbar.tsx
 * App-wide navigation bar with Polish identity chrome.
 * White background, 3px #D4213D bottom border, flag icon, "P" accent, language switcher.
 * Background is always white — never dark, never changes with AQI level.
 * Used in: root layout (Phase 4b) and page-level (Phase 3+).
 */
"use client";
import PolishFlagIcon from "./PolishFlagIcon";
import LanguageSwitcher, { type Lang } from "./LanguageSwitcher";

type Props = {
  lang: Lang;
  onLangChange: (l: Lang) => void;
  cityLabel?: string;
};

export default function Navbar({ lang, onLangChange, cityLabel }: Props) {
  return (
    <header style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 20px",
      height: 52,
      background: "var(--color-background-primary)",
      borderBottom: "3px solid #D4213D",
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <PolishFlagIcon width={24} height={16} />
        <span style={{
          fontSize: 16, fontWeight: 500,
          color: "var(--color-text-primary)",
          letterSpacing: "-0.01em",
        }}>
          <span style={{ color: "#D4213D" }}>P</span>owietrze
        </span>
        {cityLabel && (
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)", marginLeft: 4 }}>
            · {cityLabel}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <LanguageSwitcher lang={lang} onChange={onLangChange} />
      </div>
    </header>
  );
}
