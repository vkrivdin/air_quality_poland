/**
 * Returns a simple "current reading" snapshot for Kraków.
 * For now this reads the most recent row for a single station (gios_krk_1).
 */
import { NextResponse } from "next/server";
import { supabaseServiceClient } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabaseServiceClient
      .from("readings")
      .select(
        "station_id, measured_at, pm25, pm10, no2, o3, so2, co, aqi_value, aqi_level",
      )
      .eq("station_id", "gios_krk_1")
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          status: "error",
          message: "Failed to load current reading for Kraków.",
          supabaseError: error.message,
        },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          status: "empty",
          message: "No readings found for Kraków yet.",
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        reading: data,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error while loading Kraków reading.";

    return NextResponse.json(
      {
        status: "error",
        message,
      },
      { status: 500 },
    );
  }
}

