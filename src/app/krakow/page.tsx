/**
 * krakow/page.tsx — Kraków air quality dashboard
 * Shows current AQI, real pollutant readings in µg/m³, all Kraków stations,
 * and an interactive map. All data from local JSON snapshots (no Supabase needed).
 */

import Link from "next/link";
import MapWrapper from "@/app/components/MapWrapper";
import { getKrakowStations, getKrakowReadings, getPrimaryKrakowStation } from "@/lib/localData";
import { getAqiMeta, AQI_LEVELS } from "@/lib/types";

const POLLUTANT_INFO: Record<string, { label: string; unit: string; badAbove: number }> = {
  "PM2.5": { label: "PM2.5", unit: "µg/m³", badAbove: 35 },
  PM10:    { label: "PM10",  unit: "µg/m³", badAbove: 50 },
  NO2:     { label: "NO₂",   unit: "µg/m³", badAbove: 100 },
  O3:      { label: "O₃",    unit: "µg/m³", badAbove: 120 },
  SO2:     { label: "SO₂",   unit: "µg/m³", badAbove: 80 },
  CO:      { label: "CO",    unit: "µg/m³", badAbove: 10000 },
};

function pollutantColor(param: string, value: number): string {
  const info = POLLUTANT_INFO[param];
  if (!info) return "#9ca3af";
  const ratio = value / info.badAbove;
  if (ratio <= 0.4) return "#4CAF50";
  if (ratio <= 0.8) return "#FF9800";
  return "#F44336";
}

export default function KrakowPage() {
  const krakowStations = getKrakowStations();
  const readings = getKrakowReadings();
  const { summary: primary, readings: primaryReadings } = getPrimaryKrakowStation();

  const aqiMeta = getAqiMeta(primary.aqi.level_name);
  const calcDate = primary.aqi.calc_date
    ? new Date(primary.aqi.calc_date).toLocaleString("pl", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : null;

  const worstScore = Math.max(...krakowStations.map((s) => s.aqi.score ?? 0));
  const showWarning = worstScore >= 5;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-50">
      {/* Warning banner */}
      {showWarning && (
        <div className="sticky top-0 z-50 bg-red-900/80 px-4 py-2 backdrop-blur-sm">
          <p className="text-center text-sm font-medium text-red-100">
            ⚠️ Ostrzeżenie smogowe — unikaj długiego przebywania na zewnątrz
          </p>
        </div>
      )}

      {/* Nav */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-slate-400 hover:text-white transition">
            ← Mapa Polski
          </Link>
          <span className="text-slate-700">·</span>
          <h1 className="text-sm font-semibold text-white">Kraków — jakość powietrza</h1>
        </div>
        <span className="text-xs text-slate-500">Dane: GIOŚ demo</span>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-col gap-6">

          {/* ── AQI hero + pollutant cards ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {/* AQI hero */}
            <div
              className="col-span-2 sm:col-span-1 rounded-2xl p-5 flex flex-col justify-between"
              style={{
                background: `linear-gradient(135deg, ${aqiMeta.color}20 0%, ${aqiMeta.color}08 100%)`,
                border: `1px solid ${aqiMeta.color}44`,
              }}
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Indeks AQI
                </p>
                <p className="mt-0.5 text-xs text-slate-500 truncate">{primary.name.replace("Kraków, ", "")}</p>
              </div>
              <div className="mt-4">
                <div className="text-5xl font-bold" style={{ color: aqiMeta.color }}>
                  {primary.aqi.score ?? "—"}
                </div>
                <div className="mt-1 text-xl font-semibold" style={{ color: aqiMeta.color }}>
                  {aqiMeta.label_pl}
                </div>
                <div className="text-xs text-slate-500">{aqiMeta.label_en}</div>
                {calcDate && (
                  <p className="mt-3 text-[10px] text-slate-600">Akt.: {calcDate}</p>
                )}
              </div>
            </div>

            {/* Pollutant value cards */}
            {primaryReadings &&
              Object.entries(primaryReadings.pollutants)
                .filter(([, r]) => r !== null && r !== undefined)
                .map(([param, reading]) => {
                  if (!reading) return null;
                  const info = POLLUTANT_INFO[param];
                  const color = pollutantColor(param, reading.value);
                  const fillPct = Math.min(100, Math.round((reading.value / (info?.badAbove ?? reading.value)) * 100));
                  return (
                    <div
                      key={param}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                    >
                      <p className="text-xs font-medium text-slate-400">{info?.label ?? param}</p>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-2xl font-bold" style={{ color }}>{reading.value}</span>
                        <span className="text-xs text-slate-500">{info?.unit ?? "µg/m³"}</span>
                      </div>
                      {/* Thin progress bar */}
                      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${fillPct}%`, background: color }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-600">
                        {fillPct}% limitu normy
                      </p>
                    </div>
                  );
                })}
          </div>

          {/* ── All Kraków stations ── */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-300">
              Wszystkie stacje w Krakowie ({krakowStations.length})
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {krakowStations.map((station) => {
                const meta = getAqiMeta(station.aqi.level_name);
                const r = readings.find((r) => r.id === station.id);
                const pm10 = r?.pollutants?.PM10?.value;
                const pm25 = r?.pollutants?.["PM2.5"]?.value;
                return (
                  <div
                    key={station.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-200">
                        {station.name.replace(/^Kraków,\s*/i, "")}
                      </p>
                      <div className="mt-0.5 flex gap-3 text-xs text-slate-500">
                        {pm10 != null && <span>PM10: <span className="text-slate-300">{pm10}</span></span>}
                        {pm25 != null && <span>PM2.5: <span className="text-slate-300">{pm25}</span></span>}
                        {pm10 == null && pm25 == null && <span>Brak odczytów</span>}
                      </div>
                    </div>
                    <span
                      className="ml-3 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}55` }}
                    >
                      {meta.label_pl}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Kraków map ── */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-300">Mapa stacji — Kraków</h2>
            <div className="h-80 overflow-hidden rounded-2xl border border-slate-800">
              <MapWrapper stations={krakowStations} focusStationId={primary.id} className="h-full w-full" />
            </div>
          </div>

          {/* ── AQI scale reference ── */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-300">Skala indeksu jakości powietrza (PL)</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(AQI_LEVELS).map(([name, meta]) => (
                <div
                  key={name}
                  className="flex items-center gap-2 rounded-full px-3 py-1"
                  style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}44` }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                  <span className="text-xs" style={{ color: meta.color }}>{name}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      <footer className="border-t border-slate-800 px-4 py-4 text-center">
        <p className="text-xs text-slate-600">
          Dane: GIOŚ ·{" "}
          <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300">
            Created with Perplexity Computer
          </a>
        </p>
      </footer>
    </div>
  );
}
