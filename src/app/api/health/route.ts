/**
 * Health check endpoint for Powietrze backend integrations.
 * Verifies that the application can reach Supabase and read from the database.
 */
import { NextResponse } from "next/server";
import { supabaseServiceClient } from "@/lib/supabase";

export async function GET() {
  try {
    const { error } = await supabaseServiceClient
      .from("stations")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        {
          status: "degraded",
          message: "Connected to Supabase, but query failed.",
          supabaseError: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        message: "Supabase connection healthy.",
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error while checking health.";

    return NextResponse.json(
      {
        status: "error",
        message,
      },
      { status: 500 },
    );
  }
}

