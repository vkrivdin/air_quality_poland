"use client";

/**
 * PolandMap.tsx
 * Interactive Leaflet map showing all 289 GIOŚ monitoring stations across Poland.
 * Each station marker is color-coded by its current AQI level.
 * Clicking a marker shows a popup with station details and pollutant index levels.
 *
 * Uses dynamic import on the parent side to avoid SSR issues with Leaflet.
 */

import { useEffect, useRef } from "react";
import type { StationSummary } from "@/lib/types";
import { getAqiMeta } from "@/lib/types";

type Props = {
  stations: StationSummary[];
  /** If set, the map flies to this station on load */
  focusStationId?: string;
};

// We load Leaflet dynamically inside useEffect to avoid SSR crashes
export default function PolandMap({ stations, focusStationId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamically import Leaflet (client-only)
    import("leaflet").then((L) => {
      // Fix default icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // If focusStationId is provided, start zoomed in on that city
      const focusStation = focusStationId ? stations.find((s) => s.id === focusStationId) : null;
      const initialCenter: [number, number] = focusStation
        ? [focusStation.lat, focusStation.lon]
        : [51.9, 19.1];
      const initialZoom = focusStation ? 12 : 6;

      const map = L.map(mapRef.current!, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: true,
        attributionControl: true,
      });

      mapInstanceRef.current = map;

      // Dark OpenStreetMap tile layer (CartoDB Dark Matter)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      // Create a circle marker for each station, colored by AQI
      stations.forEach((station) => {
        const meta = getAqiMeta(station.aqi.level_name);
        const hasData = station.aqi.score !== null;

        const marker = L.circleMarker([station.lat, station.lon], {
          radius: hasData ? 8 : 5,
          fillColor: meta.color,
          color: hasData ? "rgba(255,255,255,0.3)" : "transparent",
          weight: 1,
          opacity: 1,
          fillOpacity: hasData ? 0.85 : 0.4,
        });

        // Build popup content
        const aqi = station.aqi;
        const levelDisplay = aqi.level_name ?? "Brak danych";
        const levelEn = aqi.level_name_en ?? "No data";

        const pollutantRows = [
          aqi.pm25_level && `<tr><td class="pr-3 text-gray-400">PM2.5</td><td>${aqi.pm25_level}</td></tr>`,
          aqi.pm10_level && `<tr><td class="pr-3 text-gray-400">PM10</td><td>${aqi.pm10_level}</td></tr>`,
          aqi.no2_level && `<tr><td class="pr-3 text-gray-400">NO₂</td><td>${aqi.no2_level}</td></tr>`,
          aqi.o3_level && `<tr><td class="pr-3 text-gray-400">O₃</td><td>${aqi.o3_level}</td></tr>`,
          aqi.so2_level && `<tr><td class="pr-3 text-gray-400">SO₂</td><td>${aqi.so2_level}</td></tr>`,
        ]
          .filter(Boolean)
          .join("");

        const dateStr = aqi.calc_date
          ? new Date(aqi.calc_date).toLocaleTimeString("pl", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : null;

        const popup = `
          <div style="min-width:200px; font-family: system-ui, sans-serif;">
            <div style="font-weight:600; font-size:13px; margin-bottom:4px; color:#f0f4ff;">
              ${station.name}
            </div>
            <div style="font-size:11px; color:#9ca3af; margin-bottom:8px;">
              ${station.city} · ${station.voivodeship}
            </div>
            <div style="display:inline-block; padding:3px 10px; border-radius:9999px; background:${meta.color}22; border:1px solid ${meta.color}88; color:${meta.color}; font-size:12px; font-weight:600; margin-bottom:8px;">
              ${levelDisplay} <span style="opacity:0.7; font-weight:400;">(${levelEn})</span>
            </div>
            ${
              pollutantRows
                ? `<table style="font-size:11px; width:100%; color:#d1d5db;">${pollutantRows}</table>`
                : '<p style="font-size:11px; color:#6b7280;">Brak danych cząstkowych</p>'
            }
            ${dateStr ? `<p style="font-size:10px; color:#6b7280; margin-top:6px;">Aktualizacja: ${dateStr}</p>` : ""}
          </div>
        `;

        marker.bindPopup(popup, { maxWidth: 280 });
        marker.addTo(map);
      });

      // Focus on a specific station if requested
      if (focusStationId) {
        const target = stations.find((s) => s.id === focusStationId);
        if (target) {
          map.setView([target.lat, target.lon], 12);
        }
      }
    });

    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapInstanceRef.current as any).remove();
        mapInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mapRef} className="h-full w-full" />;
}
