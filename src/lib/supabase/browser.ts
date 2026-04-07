/**
 * Supabase BROWSER client — for use in Client Components ("use client").
 *
 * Uses the anon key and the user's session stored in cookies.
 * Subject to Row Level Security (RLS) policies.
 * Never use the service role key here — it would be exposed to the browser.
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
