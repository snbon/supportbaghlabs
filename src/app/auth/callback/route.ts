import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Auth callback — handles two cases:
 *
 * 1. token_hash (used by our invitation / resend flows):
 *    Calls verifyOtp directly — no PKCE verifier needed.
 *
 * 2. code (PKCE — used by Supabase's own OAuth / magic-link flows):
 *    Exchanges the code for a session via exchangeCodeForSession.
 *
 * Uses cookies() from next/headers so that session cookies are written
 * into the response through Next.js's standard cookie mechanism, then
 * uses redirect() from next/navigation to navigate — this is the correct
 * pattern for Route Handlers in Next.js 16.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type       = searchParams.get("type") as EmailOtpType | null;
  const code       = searchParams.get("code");
  const next       = searchParams.get("next") ?? "/";

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) {
      console.error("[auth/callback] verifyOtp failed:", error.message, {
        type,
        token_hash: token_hash.slice(0, 8) + "…",
      });
    } else {
      redirect(next);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    } else {
      redirect(next);
    }
  }

  // Link expired, already used, or invalid — send back to login
  redirect("/");
}
