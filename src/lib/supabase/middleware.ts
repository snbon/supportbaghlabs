/**
 * Supabase session refresh for the Proxy (Node.js runtime in Next 16).
 *
 * `getClaims()` verifies the access token locally when the project uses
 * asymmetric JWT signing keys (no network round trip), refreshes it when
 * expired, and writes any new cookies onto the response. With legacy HS256
 * secrets it transparently falls back to a server-side check.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh + verify. Do not redirect here; pages decide what to render.
  await supabase.auth.getClaims();

  return supabaseResponse;
}
