/**
 * Dev-only endpoint to import GIOŚ stations for a given city into Supabase.
 * This is intended for manual use during development, not for production.
 */

import { NextResponse } from "next/server";
import { importGiosStationsForCity } from "@/lib/gios";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production." },
      { status: 404 },
    );
  }

  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") ?? "Kraków";

  try {
    const result = await importGiosStationsForCity(city);

    return NextResponse.json(
      {
        status: "ok",
        ...result,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error while importing GIOŚ stations.";

    return NextResponse.json(
      {
        status: "error",
        city,
        message,
      },
      { status: 500 },
    );
  }
}

