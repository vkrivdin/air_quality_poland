/**
 * Returns stations for Kraków from Supabase.
 * Used by the Kraków dashboard to show real station metadata.
 */
import { NextResponse } from "next/server";
import { supabaseServiceClient } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabaseServiceClient
      .from("stations")
      .select("id, name, city, latitude, longitude")
      .eq("city", "Kraków")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          status: "error",
          message: "Failed to load Kraków stations.",
          supabaseError: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        count: data?.length ?? 0,
        stations: data ?? [],
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error while loading Kraków stations.";

    return NextResponse.json(
      {
        status: "error",
        message,
      },
      { status: 500 },
    );
  }
}

