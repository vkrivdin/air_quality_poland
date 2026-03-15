"use client";

/**
 * PolandMap.tsx
 * Interactive Leaflet map showing all GIOŚ monitoring stations across Poland.
 * Each station is a color-coded circle marker by AQI level, with a rich popup.
 *
 * Why vanilla Leaflet (not react-leaflet):
 * - react-leaflet v5 + React 19 Strict Mode causes double-mount issues
 * - Direct Leaflet gives us full control over lifecycle and cleanup
 *
 * Why dynamic import inside useEffect:
 * - Leaflet accesses `window` on import — must be client-only
 */

import { useEffect, useRef } from "react";
import type { StationSummary } from "@/lib/types";
import { giosLabelToKey, getLevelConfig } from "@/lib/aqi-config";

type Props = {
  stations: StationSummary[];
  focusStationId?: string;
};

export default function PolandMap({ stations, focusStationId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Store the Leaflet map instance so cleanup can remove it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Guard: if Leaflet already initialized this DOM node (Strict Mode double-mount),
    // remove the stale _leaflet_id so L.map() can start fresh.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = containerRef.current as any;
    if (el._leaflet_id) {
      delete el._leaflet_id;
    }

    // If we somehow still have a live map instance, destroy it first
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    let cancelled = false;

    import("leaflet").then((L) => {
      // Leaflet CSS — imported here so it only loads client-side
      // (avoids Tailwind v4 PostCSS pipeline issues with @import)
      import("leaflet/dist/leaflet.css").catch(() => {
        // CSS import may already be handled by the bundler; ignore if it fails
      });

      if (cancelled || !containerRef.current) return;

      // Guard again in case of race condition
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const node = containerRef.current as any;
      if (node._leaflet_id) delete node._leaflet_id;

      const focusStation = focusStationId
        ? stations.find((s) => s.id === focusStationId)
        : null;

      const initialCenter: [number, number] = focusStation
        ? [focusStation.lat, focusStation.lon]
        : [51.9, 19.1];
      const initialZoom = focusStation ? 12 : 6;

      const map = L.map(containerRef.current!, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: true,
        attributionControl: true,
      });

      mapRef.current = map;

      // CartoDB Voyager — clean light basemap, Polish labels, no API key needed
      // Note: the old dark_matter subdomain URL format (*.basemaps.cartocdn.com/dark_matter)
      // returns 404. The working URL pattern is basemaps.cartocdn.com/rastertiles/<style>.
      L.tileLayer(
        "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 19,
        },
      ).addTo(map);

      // AQI circle markers
      stations.forEach((station) => {
        const meta = getLevelConfig(giosLabelToKey(station.aqi.level_name));
        const hasData = station.aqi.score !== null;

        const marker = L.circleMarker([station.lat, station.lon], {
          radius: hasData ? 8 : 5,
          fillColor: meta.color.primary,
          color: hasData ? "rgba(255,255,255,0.25)" : "transparent",
          weight: 1,
          opacity: 1,
          fillOpacity: hasData ? 0.85 : 0.35,
        });

        const aqi = station.aqi;
        const levelDisplay = aqi.level_name ?? "Brak danych";
        const levelEn = aqi.level_name_en ?? "No data";

        const rows = [
          aqi.pm25_level ? `<tr><td style="padding-right:12px;color:#9ca3af">PM2.5</td><td>${aqi.pm25_level}</td></tr>` : "",
          aqi.pm10_level ? `<tr><td style="padding-right:12px;color:#9ca3af">PM10</td><td>${aqi.pm10_level}</td></tr>` : "",
          aqi.no2_level  ? `<tr><td style="padding-right:12px;color:#9ca3af">NO₂</td><td>${aqi.no2_level}</td></tr>` : "",
          aqi.o3_level   ? `<tr><td style="padding-right:12px;color:#9ca3af">O₃</td><td>${aqi.o3_level}</td></tr>` : "",
          aqi.so2_level  ? `<tr><td style="padding-right:12px;color:#9ca3af">SO₂</td><td>${aqi.so2_level}</td></tr>` : "",
        ].join("");

        const timeStr = aqi.calc_date
          ? new Date(aqi.calc_date).toLocaleTimeString("pl", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : null;

        marker.bindPopup(
          `<div style="min-width:200px;font-family:system-ui,sans-serif;font-size:13px">
            <div style="font-weight:600;margin-bottom:2px;color:#1a1a18">${station.name}</div>
            <div style="font-size:11px;color:#6b6b67;margin-bottom:8px">${station.city} · ${station.voivodeship}</div>
            <div style="display:inline-block;padding:2px 10px;border-radius:9999px;background:${meta.color.bg};border:1px solid ${meta.color.border};color:${meta.color.text};font-weight:600;margin-bottom:8px">
              ${levelDisplay} <span style="opacity:.6;font-weight:400">(${levelEn})</span>
            </div>
            ${rows ? `<table style="font-size:11px;color:#444441;width:100%">${rows}</table>` : '<p style="font-size:11px;color:#9b9b97">Brak danych cząstkowych</p>'}
            ${timeStr ? `<p style="font-size:10px;color:#9b9b97;margin-top:6px">Akt.: ${timeStr}</p>` : ""}
          </div>`,

          { maxWidth: 280 },
        );

        marker.addTo(map);
      });
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // Stations and focusStationId are stable server-rendered props — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}
