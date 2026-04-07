/**
 * Supabase SERVER client — for use in Server Components and Server Actions.
 *
 * Reads/writes auth cookies via Next.js `cookies()` so the user's session
 * is available on the server. Still uses the anon key and respects RLS.
 *
 * Must be called inside an async Server Component or a Server Action,
 * because `cookies()` requires a request context.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  // `cookies()` is async in Next.js 15 / App Router
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Forward all cookies from the incoming request to Supabase
        getAll() {
          return cookieStore.getAll();
        },
        // Write any new/refreshed auth cookies back into the response
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // `setAll` can throw in Server Components (read-only).
            // Safe to ignore — the middleware handles cookie refresh.
          }
        },
      },
    }
  );
}
