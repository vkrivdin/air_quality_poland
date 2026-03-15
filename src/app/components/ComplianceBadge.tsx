/**
 * ComplianceBadge.tsx
 * Clickable pill badge showing Kraków's compliance status vs EU/WHO limits.
 * Text is computed by getComplianceBadge() from aqi-config — never hardcoded.
 * Opens ComplianceModal on click.
 */
"use client";
import { useState } from "react";
import { getComplianceBadge } from "@/lib/aqi-config";
import ComplianceModal from "./ComplianceModal";
import type { Lang } from "./LanguageSwitcher";

type Props = { lang: Lang; cityName: string; };

const SEVERITY_STYLES = {
  green: { bg: "#EAF3DE", border: "#3B6D11", color: "#27500A" },
  amber: { bg: "#FAEEDA", border: "#854F0B", color: "#633806" },
  red:   { bg: "#FCEBEB", border: "#A32D2D", color: "#791F1F" },
};

export default function ComplianceBadge({ lang, cityName }: Props) {
  const [open, setOpen] = useState(false);
  const badge = getComplianceBadge();
  const s = SEVERITY_STYLES[badge.severity];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: s.bg, border: `0.5px solid ${s.border}`,
          color: s.color, fontSize: 12, fontWeight: 500,
          padding: "5px 12px", borderRadius: 20, cursor: "pointer",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1"/>
          <line x1="6" y1="4" x2="6" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <circle cx="6" cy="8.2" r="0.6" fill="currentColor"/>
        </svg>
        {lang === "pl" ? badge.text_pl : badge.text_en}
      </button>
      <ComplianceModal isOpen={open} onClose={() => setOpen(false)} lang={lang} cityName={cityName} />
    </>
  );
}
