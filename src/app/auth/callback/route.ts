import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Auth callback — handles two cases:
 *
 * 1. token_hash (used by our invitation / resend flows):
 *    Calls verifyOtp directly — no PKCE verifier needed, works reliably with
 *    server-side Supabase clients.
 *
 * 2. code (PKCE — used by Supabase's own OAuth / magic-link flows):
 *    Exchanges the code for a session via exchangeCodeForSession.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type       = searchParams.get("type") as EmailOtpType | null;
  const code       = searchParams.get("code");
  const next       = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Link expired or invalid — send back to login
  return NextResponse.redirect(`${origin}/`);
}
