/**
 * Footer.tsx
 * Site-wide footer rendered inside PageShell below the city panel.
 * Shows four SourceBadge attribution chips (GIOŚ, Airly, EU Directive, WHO)
 * plus the DISCLAIMER text from aqi-config and a copyright line.
 *
 * Props:
 *   lang — "pl" | "en" forwarded to SourceBadge and disclaimer copy
 *
 * Design notes:
 *   - Background: --color-background-secondary (off-white) to lift off page white
 *   - Top border: --color-border-tertiary (hairline)
 *   - Two rows: badges row + disclaimer row
 *   - Inline styles only (no Tailwind — Phase 2+ convention)
 *   - Not "use client" — no browser APIs or stateful hooks needed
 */

import SourceBadge from "./SourceBadge";
import { DISCLAIMER } from "@/lib/aqi-config";
import type { Lang } from "./LanguageSwitcher";

type Props = {
  lang: Lang;
};

export default function Footer({ lang }: Props) {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        background: "var(--color-background-secondary)",
        borderTop: "1px solid var(--color-border-tertiary)",
        padding: "20px 20px 16px",
      }}
    >
      {/* Source badges row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <SourceBadge source="gios" lang={lang} />
        <SourceBadge source="airly" lang={lang} />
        <SourceBadge source="eu_directive" lang={lang} />
        <SourceBadge source="who" lang={lang} />
      </div>

      {/* Disclaimer */}
      <p
        style={{
          fontSize: 11,
          lineHeight: 1.55,
          color: "var(--color-text-tertiary)",
          margin: "0 0 10px",
        }}
      >
        {lang === "pl" ? DISCLAIMER.pl : DISCLAIMER.en}
      </p>

      {/* Copyright */}
      <p
        style={{
          fontSize: 11,
          color: "var(--color-text-tertiary)",
          margin: 0,
        }}
      >
        © {year} Powietrze.
      </p>
    </footer>
  );
}
