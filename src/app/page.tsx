import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sky-50 px-4 py-8 font-sans dark:bg-slate-950">
      <main className="mx-auto flex w-full max-w-3xl flex-col items-center gap-10 rounded-3xl bg-white/80 px-8 py-12 text-center shadow-xl backdrop-blur-sm dark:bg-slate-900/80 sm:px-12 sm:py-16">
        <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-4 py-1 text-xs font-medium uppercase tracking-wide text-sky-800 dark:bg-sky-900/70 dark:text-sky-100">
          Powietrze
          <span className="h-1 w-1 rounded-full bg-sky-500" />
          Kraków · Polska
        </div>

        <div className="flex flex-col items-center gap-4">
          <h1 className="text-balance text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl dark:text-slate-50">
            Jakość powietrza w Polsce,
            <br className="hidden sm:block" /> ze szczególnym
            uwzględnieniem Krakowa.
          </h1>
          <p className="max-w-xl text-balance text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Przeglądaj aktualny stan powietrza, ostrzeżenia o smogu oraz
            historyczne trendy jakości powietrza – wszystko w jednym, prostym
            panelu.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Link href="/krakow" className="inline-flex items-center justify-center rounded-full bg-sky-600 px-8 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:ring-offset-slate-900">
            Przejdź do panelu Kraków
          </Link>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            MVP — dane przykładowe / w trakcie budowy
          </span>
        </div>
      </main>
    </div>
  );
}
