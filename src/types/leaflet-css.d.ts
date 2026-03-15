/**
 * leaflet-css.d.ts
 * Type declaration for the dynamic CSS import in PolandMap.tsx.
 * Leaflet's CSS is loaded client-side via import("leaflet/dist/leaflet.css")
 * to avoid Tailwind v4 PostCSS pipeline issues with static @import.
 */
declare module "leaflet/dist/leaflet.css" {
  const content: string;
  export default content;
}
