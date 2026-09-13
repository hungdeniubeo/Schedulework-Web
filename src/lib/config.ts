import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export const configurationError =
  !url || !publishableKey
    ? "Thiếu cấu hình Supabase. Hãy đặt VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY."
    : null;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (configurationError) throw new Error(configurationError);
  client ??= createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}

export function getPublicSupabaseConfig(): {
  url: string;
  publishableKey: string;
} {
  if (configurationError) throw new Error(configurationError);
  return { url, publishableKey };
}
