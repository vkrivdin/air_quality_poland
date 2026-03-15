/**
 * CitySearch.tsx
 * Search bar + geolocation button for finding air quality by location.
 *
 * Two input modes:
 *  1. Text search — queries Nominatim (OpenStreetMap geocoding, free, no key)
 *     filtered to Poland, then maps the result to the nearest GIOŚ station city.
 *  2. Geolocation — requests browser position, finds the nearest GIOŚ station,
 *     navigates to /?city=<slug>.
 *
 * On selection, navigates to /?city=<slug> using a full page navigation so
 * the Server Component (page.tsx) re-runs with the new city param.
 *
 * Uses inline styles only (Phase 2+ convention). No Tailwind classes.
 */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Lang } from "./LanguageSwitcher";
import { cityToSlug } from "@/lib/localData";
import type { StationSummary } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
  };
};

type DropdownItem = {
  label: string;
  sublabel: string;
  slug: string;
  lat: number;
  lon: number;
};

// ─── Distance helper ──────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Find the city whose centroid (mean station lat/lon) is nearest to a point. */
function nearestCitySlug(
  lat: number,
  lon: number,
  stations: StationSummary[],
): { slug: string; city: string; distanceKm: number } {
  // Build city centroids
  const cityMap = new Map<string, { city: string; lats: number[]; lons: number[] }>();
  for (const s of stations) {
    const slug = cityToSlug(s.city);
    const entry = cityMap.get(slug) ?? { city: s.city, lats: [], lons: [] };
    entry.lats.push(s.lat);
    entry.lons.push(s.lon);
    cityMap.set(slug, entry);
  }

  let bestSlug = "";
  let bestCity = "";
  let bestDist = Infinity;

  for (const [slug, { city, lats, lons }] of cityMap) {
    const centLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const centLon = lons.reduce((a, b) => a + b, 0) / lons.length;
    const dist = haversineKm(lat, lon, centLat, centLon);
    if (dist < bestDist) {
      bestDist = dist;
      bestSlug = slug;
      bestCity = city;
    }
  }

  return { slug: bestSlug, city: bestCity, distanceKm: Math.round(bestDist * 10) / 10 };
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  lang: Lang;
  stations: StationSummary[]; // passed from PageShell (already loaded)
};

export default function CitySearch({ lang, stations }: Props) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<DropdownItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Close dropdown on outside click ───────────────────────────────────────
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // ── Nominatim search ───────────────────────────────────────────────────────
  const search = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setItems([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", q);
        url.searchParams.set("format", "json");
        url.searchParams.set("countrycodes", "pl");
        url.searchParams.set("addressdetails", "1");
        url.searchParams.set("limit", "6");

        const res = await fetch(url.toString(), {
          headers: { "Accept-Language": lang === "pl" ? "pl,en" : "en,pl" },
        });
        if (!res.ok) throw new Error("Nominatim error");
        const results: NominatimResult[] = await res.json();

        const seen = new Set<string>();
        const mapped: DropdownItem[] = [];

        for (const r of results) {
          const lat = parseFloat(r.lat);
          const lon = parseFloat(r.lon);
          const nearest = nearestCitySlug(lat, lon, stations);
          if (seen.has(nearest.slug)) continue;
          seen.add(nearest.slug);

          // Extract the most specific place name from display_name
          const addr = r.address ?? {};
          const placeName =
            addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? r.display_name.split(",")[0];
          const region = addr.state ?? addr.county ?? "";

          mapped.push({
            label: placeName,
            sublabel: `${lang === "pl" ? "Najbliższa stacja" : "Nearest station"}: ${nearest.city} · ${nearest.distanceKm} km`,
            slug: nearest.slug,
            lat,
            lon,
          });
        }

        setItems(mapped);
        setOpen(mapped.length > 0);
      } catch {
        setItems([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [lang, stations],
  );

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  }

  function onSelect(item: DropdownItem) {
    setOpen(false);
    setQuery("");
    window.location.href = `/?city=${item.slug}`;
  }

  // ── Geolocation ────────────────────────────────────────────────────────────
  function onGeoClick() {
    if (!navigator.geolocation) {
      setGeoError(lang === "pl" ? "Geolokalizacja niedostępna" : "Geolocation unavailable");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const { latitude, longitude } = pos.coords;
        const nearest = nearestCitySlug(latitude, longitude, stations);
        window.location.href = `/?city=${nearest.slug}`;
      },
      () => {
        setGeoLoading(false);
        setGeoError(lang === "pl" ? "Brak dostępu do lokalizacji" : "Location access denied");
      },
      { timeout: 8000 },
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>

      {/* Search input */}
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={onInput}
          onFocus={() => items.length > 0 && setOpen(true)}
          placeholder={lang === "pl" ? "Szukaj miasta…" : "Search city…"}
          style={{
            width: 200,
            height: 32,
            padding: "0 10px 0 30px",
            fontSize: 13,
            border: "0.5px solid var(--color-border-primary)",
            borderRadius: 8,
            background: "var(--color-background-secondary)",
            color: "var(--color-text-primary)",
            outline: "none",
            transition: "border-color 0.15s, width 0.2s",
          }}
          onFocusCapture={(e) => {
            (e.target as HTMLInputElement).style.width = "240px";
            (e.target as HTMLInputElement).style.borderColor = "#D4213D";
          }}
          onBlurCapture={(e) => {
            (e.target as HTMLInputElement).style.width = "200px";
            (e.target as HTMLInputElement).style.borderColor = "var(--color-border-primary)";
          }}
        />
        {/* Search icon */}
        <svg
          style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          width={14} height={14} viewBox="0 0 16 16" fill="none"
        >
          <circle cx="6.5" cy="6.5" r="4.5" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
          <path d="M10 10L14 14" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {/* Loading spinner */}
        {loading && (
          <div style={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            width: 12, height: 12,
            border: "1.5px solid var(--color-border-primary)",
            borderTopColor: "#D4213D",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
          }} />
        )}
      </div>

      {/* Geolocation button */}
      <button
        onClick={onGeoClick}
        disabled={geoLoading}
        title={lang === "pl" ? "Użyj mojej lokalizacji" : "Use my location"}
        style={{
          width: 32, height: 32,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "0.5px solid var(--color-border-primary)",
          borderRadius: 8,
          background: geoLoading ? "var(--color-background-tertiary)" : "var(--color-background-secondary)",
          cursor: geoLoading ? "default" : "pointer",
          flexShrink: 0,
          transition: "background 0.15s",
        }}
      >
        {geoLoading ? (
          <div style={{
            width: 12, height: 12,
            border: "1.5px solid var(--color-border-primary)",
            borderTopColor: "#D4213D",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
          }} />
        ) : (
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3.5" stroke="var(--color-text-secondary)" strokeWidth="1.8" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="var(--color-text-secondary)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Geo error */}
      {geoError && (
        <span style={{ fontSize: 11, color: "#993C1D", whiteSpace: "nowrap" }}>
          {geoError}
        </span>
      )}

      {/* Dropdown */}
      {open && items.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: 300,
            background: "var(--color-background-primary)",
            border: "0.5px solid var(--color-border-primary)",
            borderRadius: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          {items.map((item, i) => (
            <button
              key={item.slug + i}
              onClick={() => onSelect(item)}
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 2,
                padding: "9px 14px",
                background: "transparent",
                border: "none",
                borderBottom: i < items.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-background-secondary)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
                {item.label}
              </span>
              <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                {item.sublabel}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Spinner keyframe — injected once */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
