/**
 * Supabase middleware helper — refreshes the user's session on every request.
 *
 * Called from `src/middleware.ts`. Uses the request/response cookie pattern
 * (not `next/headers`) because middleware runs in the Edge runtime before
 * the request reaches any Server Component.
 *
 * Without this, server-rendered pages would see expired sessions even when
 * the user is still actively using the app.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Start with a passthrough response — we'll attach cookies to it
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
          // Apply cookies to both the outgoing request and the response.
          // The request cookies let downstream Server Components see them;
          // the response cookies send them back to the browser.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — this is the key call that keeps sessions alive.
  // Do NOT remove or move this call; it must run before any other logic.
  await supabase.auth.getUser();

  return supabaseResponse;
}
