/**
 * ActivityMatrix.tsx
 * 5-column grid showing activity recommendations (safe/caution/avoid)
 * for a given AQI level. State colours are fixed — they represent the
 * activity state, not the AQI level colour.
 * Uses inline styles only (no Tailwind). "no_data" is excluded by type.
 */
import {
  AQI_LEVEL_CONFIGS, ACTIVITY_DISPLAY_ORDER, ACTIVITY_LABELS,
} from "@/lib/aqi-config";
import type { AqiLevelKey, ActivityKey, ActivityState } from "@/lib/aqi-config";

type Props = {
  levelKey: Exclude<AqiLevelKey, "no_data">;
  lang: "pl" | "en";
};

const STATE_STYLES: Record<ActivityState, { bg: string; color: string; icon: string }> = {
  safe:    { bg: "#EAF3DE", color: "#27500A", icon: "✓" },
  caution: { bg: "#FAEEDA", color: "#633806", icon: "~" },
  avoid:   { bg: "#FCEBEB", color: "#791F1F", icon: "✗" },
};

export default function ActivityMatrix({ levelKey, lang }: Props) {
  const cfg = AQI_LEVEL_CONFIGS[levelKey];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: 6,
    }}>
      {ACTIVITY_DISPLAY_ORDER.map((actKey: ActivityKey) => {
        const cell = cfg.activities[actKey];
        const label = ACTIVITY_LABELS[actKey];
        const style = STATE_STYLES[cell.state];
        const note = lang === "pl" ? cell.note_pl : cell.note_en;

        return (
          <div key={actKey} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 4, padding: "8px 4px",
            borderRadius: 8,
            background: "var(--color-background-secondary)",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 500,
              background: style.bg, color: style.color,
            }}>
              {style.icon}
            </div>
            <div style={{
              fontSize: 10, textAlign: "center", lineHeight: 1.3,
              color: "var(--color-text-secondary)",
            }}>
              {lang === "pl" ? label.pl : label.en}
            </div>
            {note && (
              <div style={{
                fontSize: 10, textAlign: "center", lineHeight: 1.3,
                color: "var(--color-text-secondary)", opacity: 0.75,
              }}>
                {note}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
