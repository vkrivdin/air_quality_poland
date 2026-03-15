/**
 * supabase.ts
 * Supabase client helpers for the Powietrze application.
 * Uses lazy initialization — clients are only created when actually called,
 * so the build doesn't fail if env vars are not set (demo mode).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _serviceClient: SupabaseClient | null = null;
let _publicClient: SupabaseClient | null = null;

function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL is not set.");
  return url;
}

export function getServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  _serviceClient = createClient(getSupabaseUrl(), key, { auth: { persistSession: false } });
  return _serviceClient;
}

export function getPublicClient(): SupabaseClient {
  if (_publicClient) return _publicClient;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.");
  _publicClient = createClient(getSupabaseUrl(), key, { auth: { persistSession: true } });
  return _publicClient;
}

// Legacy named export for backward compatibility with existing API routes
export const supabaseServiceClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return getServiceClient()[prop as keyof SupabaseClient];
  },
});
