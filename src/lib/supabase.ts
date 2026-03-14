/**
 * Supabase client helpers for the Powietrze application.
 * Centralises creation of server-side and client-side Supabase instances.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is not set.");
}

if (!supabaseServiceRoleKey) {
  // Service role is required for server-side data fetcher and admin tasks,
  // but not for public client usage.
  // We throw here to surface misconfiguration early in development.
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
}

if (!supabaseAnonKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.");
}

export const supabaseServiceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
  },
});

export const supabasePublicClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
});

