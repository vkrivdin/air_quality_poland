/**
 * SourceBadge.tsx
 * Attribution badge for a data source (GIOŚ, Airly, EU Directive, WHO).
 * Each badge shows a flag/logo icon, source name, and a short description.
 * Used in: ComplianceModal, page footer.
 */
import PolishFlagIcon from "./PolishFlagIcon";

export type SourceKey = "gios" | "airly" | "eu_directive" | "who";

const SOURCE_DATA: Record<SourceKey, {
  icon: React.ReactNode;
  name: string;
  desc_pl: string;
  desc_en: string;
}> = {
  gios: {
    icon: <PolishFlagIcon />,
    name: "GIOŚ",
    desc_pl: "Oficjalne dane rządowe",
    desc_en: "Official government data",
  },
  airly: {
    icon: <PolishFlagIcon />,
    name: "Airly",
    desc_pl: "Krakowska sieć czujników",
    desc_en: "Kraków sensor network",
  },
  eu_directive: {
    icon: (
      <div style={{ width: 20, height: 14, borderRadius: 2, background: "#003399",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, color: "#FFD700", flexShrink: 0 }}>★</div>
    ),
    name: "Dyrektywa UE 2024/2881",
    desc_pl: "Normy na 2030 r.",
    desc_en: "2030 targets",
  },
  who: {
    icon: (
      <div style={{ width: 20, height: 14, borderRadius: 2, background: "#009EDB",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 7, color: "#ffffff", fontWeight: 700, flexShrink: 0 }}>WHO</div>
    ),
    name: "WHO AQG 2021",
    desc_pl: "Wytyczne zdrowotne",
    desc_en: "Health guidelines",
  },
};

type Props = { source: SourceKey; lang?: "pl" | "en"; };

export default function SourceBadge({ source, lang = "pl" }: Props) {
  const s = SOURCE_DATA[source];
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: 8, padding: "6px 12px",
      background: "var(--color-background-primary)",
    }}>
      {s.icon}
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>
          {s.name}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--color-text-secondary)" }}>
          {lang === "pl" ? s.desc_pl : s.desc_en}
        </div>
      </div>
    </div>
  );
}
