/**
 * GIOŚ (Polish air quality) API helpers.
 * Responsible for fetching station metadata and mapping it into the local schema.
 */

import { supabaseServiceClient } from "@/lib/supabase";

function normalizePolish(text: string): string {
  const base = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return base.replace(/[ąćęłńóśźż]/g, (ch) => {
    const map: Record<string, string> = {
      ą: "a",
      ć: "c",
      ę: "e",
      ł: "l",
      ń: "n",
      ó: "o",
      ś: "s",
      ź: "z",
      ż: "z",
    };
    return map[ch] ?? ch;
  });
}

const GIOS_BASE_URL = process.env.GIOS_API_BASE_URL ?? "https://api.gios.gov.pl/pjp-api";

type GiosStation = {
  "Identyfikator stacji": number;
  "Kod stacji": string;
  "Nazwa stacji": string;
  "WGS84 φ N": string;
  "WGS84 λ E": string;
  "Identyfikator miasta": number;
  "Nazwa miasta": string;
  Gmina: string;
  Powiat: string;
  Województwo: string;
  Ulica: string | null;
};

type GiosStationListResponse = {
  "Lista stacji pomiarowych": GiosStation[];
};

function giosStationIdToInternal(id: number): string {
  return `gios_${id}`;
}

export async function fetchAllGiosStations(): Promise<GiosStation[]> {
  const url = new URL("/v1/rest/station/findAll", GIOS_BASE_URL);
  url.searchParams.set("page", "0");
  url.searchParams.set("size", "5000");

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`Failed to fetch GIOŚ stations: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as GiosStationListResponse;
  return data["Lista stacji pomiarowych"] ?? [];
}

export async function importGiosStationsForCity(cityName: string) {
  const stations = await fetchAllGiosStations();

  const filtered = stations.filter(
    (s) => normalizePolish(s["Nazwa miasta"]) === normalizePolish(cityName),
  );

  if (filtered.length === 0) {
    return {
      imported: 0,
      city: cityName,
      message: "No stations found for requested city.",
    };
  }

  const rows = filtered.map((s) => ({
    id: giosStationIdToInternal(s["Identyfikator stacji"]),
    source: "gios",
    name: s["Nazwa stacji"],
    city: s["Nazwa miasta"],
    latitude: Number(s["WGS84 φ N"]),
    longitude: Number(s["WGS84 λ E"]),
    is_active: true,
  }));

  const { error } = await supabaseServiceClient.from("stations").upsert(rows, {
    onConflict: "id",
  });

  if (error) {
    throw new Error(`Failed to upsert GIOŚ stations into Supabase: ${error.message}`);
  }

  return {
    imported: rows.length,
    city: cityName,
    message: "GIOŚ stations imported successfully.",
  };
}

