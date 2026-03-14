export default function KrakowDashboardPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-300">
              Powietrze · Panel miasta
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Kraków — jakość powietrza
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Widok MVP z danymi przykładowymi. Warstwy mapy, wykresy i
              połączenie z danymi GIOŚ / Airly pojawią się w kolejnych
              etapach.
            </p>
          </div>

          <div className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-300">
            Status:{" "}
            <span className="font-semibold text-sky-300">
              tryb deweloperski (mock)
            </span>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <article className="rounded-2xl bg-gradient-to-br from-emerald-500 via-sky-500 to-sky-700 p-[1px]">
            <div className="flex h-full flex-col justify-between rounded-2xl bg-slate-950 px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-medium text-slate-300">
                    Aktualny indeks jakości powietrza (AQI)
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Dane przykładowe — do podpięcia pod Supabase w fazie
                    integracji.
                  </p>
                </div>
                <span className="rounded-full bg-slate-900/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                  Kraków · demo
                </span>
              </div>

              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">
                    AQI (PL)
                  </p>
                  <p className="mt-1 text-4xl font-semibold leading-none">
                    42
                  </p>
                  <p className="mt-2 text-sm text-emerald-100">
                    Bardzo dobry · możesz spokojnie wyjść na zewnątrz
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs text-slate-200">
                  <div className="rounded-xl bg-slate-900/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">
                      PM2.5
                    </p>
                    <p className="mt-1 text-sm font-semibold">12 µg/m³</p>
                  </div>
                  <div className="rounded-xl bg-slate-900/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">
                      PM10
                    </p>
                    <p className="mt-1 text-sm font-semibold">22 µg/m³</p>
                  </div>
                  <div className="rounded-xl bg-slate-900/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">
                      NO₂
                    </p>
                    <p className="mt-1 text-sm font-semibold">18 µg/m³</p>
                  </div>
                  <div className="rounded-xl bg-slate-900/70 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">
                      O₃
                    </p>
                    <p className="mt-1 text-sm font-semibold">35 µg/m³</p>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <span className="mt-[2px] inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/80 text-xs font-semibold">
                !
              </span>
              <div>
                <p className="font-semibold">Ostrzeżenia o smogu</p>
                <p className="mt-1 text-amber-100/90">
                  W tej wersji panelu ostrzeżenia są statyczne. W pełnej wersji
                  zostaną wyliczone na podstawie bieżącego AQI i progów
                  bezpieczeństwa.
                </p>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
              <h2 className="text-sm font-medium text-slate-100">
                Historia i mapa — placeholder
              </h2>
              <p className="text-xs text-slate-400">
                W kolejnych etapach tutaj pojawią się interaktywne wykresy
                (Recharts / D3) oraz mapa stacji (Leaflet) oparta na danych z
                Supabase. Na razie to miejsce pełni rolę szkicu layoutu.
              </p>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

