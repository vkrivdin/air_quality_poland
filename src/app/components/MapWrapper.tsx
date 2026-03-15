"use client";

/**
 * MapWrapper.tsx
 * Client component wrapper for the Leaflet map.
 * next/dynamic with ssr:false must live in a Client Component in Next.js 16.
 * The parent Server Components import this wrapper instead of PolandMap directly.
 */

import dynamic from "next/dynamic";
import type { StationSummary } from "@/lib/types";

const PolandMap = dynamic(() => import("./PolandMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-900">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        <p className="text-sm text-slate-400">Ładowanie mapy…</p>
      </div>
    </div>
  ),
});

type Props = {
  stations: StationSummary[];
  focusStationId?: string;
  className?: string;
};

export default function MapWrapper({ stations, focusStationId, className }: Props) {
  return (
    <div className={className ?? "h-full w-full"}>
      <PolandMap stations={stations} focusStationId={focusStationId} />
    </div>
  );
}
