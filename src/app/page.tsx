/**
 * page.tsx — Home page / Poland map view
 * Displays an interactive full-screen map of Poland with all GIOŚ stations,
 * color-coded by current AQI level. Reads from local JSON snapshot — no env vars needed.
 */

import Link from "next/link";
import MapWrapper from "@/app/components/MapWrapper";
import { getAllStations } from "@/lib/localData";
import { AQI_LEVEL_CONFIGS, AQI_NO_DATA_CONFIG } from "@/lib/aqi-config";

export default function HomePage() {
  const stations = getAllStations();

  const levelCounts: Record<string, number> = {};
  for (const s of stations) {
    const name = s.aqi.level_name ?? "Brak danych";
    levelCounts[name] = (levelCounts[name] ?? 0) + 1;
  }

  const withData = stations.filter((s) => s.aqi.score !== null).length;
  const noData = stations.length - withData;

  return (
    <div className="flex h-screen flex-col bg-[#0a0f1e] text-slate-50">
      {/* ── Top bar ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <svg
            aria-label="Powietrze logo"
            viewBox="0 0 32 32"
            fill="none"
            className="h-7 w-7"
          >
            <circle cx="16" cy="16" r="14" stroke="#38bdf8" strokeWidth="2" />
            <path
              d="M8 20 Q12 10 16 16 Q20 22 24 12"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="16" cy="16" r="3" fill="#38bdf8" opacity="0.5" />
          </svg>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white">Powietrze</h1>
            <p className="text-[10px] text-slate-400">Jakość powietrza w Polsce</p>
          </div>
        </div>

        <nav className="flex items-center gap-3">
          <span className="hidden text-xs text-slate-500 sm:block">
            {withData} stacji z danymi · {noData} bez danych
          </span>
          <Link
            href="/krakow"
            className="rounded-full bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500"
          >
            Panel Kraków →
          </Link>
        </nav>
      </header>

      {/* ── Map ── */}
      <div className="relative flex-1 overflow-hidden">
        <MapWrapper stations={stations} className="h-full w-full" />

        {/* Legend */}
        <div className="absolute top-4 left-16 z-[400] rounded-xl border border-slate-700 bg-slate-900/95 p-3 backdrop-blur-sm">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Indeks jakości powietrza
          </p>
          <div className="flex flex-col gap-1.5">
            {Object.values(AQI_LEVEL_CONFIGS).map((cfg) => (
              <div key={cfg.key} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: cfg.color.primary }} />
                  <span className="text-xs text-slate-300">{cfg.label_pl}</span>
                </div>
                <span className="text-[10px] text-slate-500">{levelCounts[cfg.label_pl] ?? 0}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: AQI_NO_DATA_CONFIG.color.primary }} />
                <span className="text-xs text-slate-300">Brak danych</span>
              </div>
              <span className="text-[10px] text-slate-500">{noData}</span>
            </div>
          </div>
        </div>

        {/* Source badge */}
        <div className="absolute bottom-4 right-4 z-[400] rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-2 backdrop-blur-sm">
          <p className="text-[10px] text-slate-400">
            Źródło:{" "}
            <a href="https://powietrze.gios.gov.pl" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
              GIOŚ
            </a>{" "}
            · {new Date().toLocaleDateString("pl", { day: "numeric", month: "long", year: "numeric" })}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">Kliknij stację, aby zobaczyć szczegóły</p>
        </div>
      </div>
    </div>
  );
}
