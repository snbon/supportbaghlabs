/**
 * Next.js Proxy (formerly Middleware) — runs on every matched request before rendering.
 *
 * Responsibility: refresh the Supabase auth session so server components
 * always have access to a valid session cookie.
 *
 * The webhook route is excluded from session refresh since it uses
 * its own authentication (GitHub webhook signature).
 *
 * Next.js 16+ uses `proxy.ts` with a `proxy` export (was `middleware.ts`).
 */

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - api/github-webhook (handles its own auth via webhook secret)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/github-webhook).*)",
  ],
};
