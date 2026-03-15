/**
 * PolishFlagIcon.tsx
 * Miniature Polish flag rendered as a flex column of two coloured divs.
 * Statutory colours: #E9E8E7 (white) over #D4213D (red).
 * Used in: Navbar, SourceBadge only.
 */

type Props = {
  width?: number;
  height?: number;
};

export default function PolishFlagIcon({ width = 20, height = 14 }: Props) {
  return (
    <div style={{
      width,
      height,
      borderRadius: 2,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      border: "0.5px solid rgba(0,0,0,0.08)",
      flexShrink: 0,
    }}>
      <div style={{ flex: 1, background: "#E9E8E7" }} />
      <div style={{ flex: 1, background: "#D4213D" }} />
    </div>
  );
}
