/**
 * Next.js Proxy (formerly Middleware) — runs before rendering for matched paths.
 *
 * Its ONLY job is to refresh the Supabase auth cookies so Server Components
 * see a live session. It is not an authorization boundary: every server action
 * and route handler authenticates through `src/lib/dal.ts`.
 *
 * The matcher skips API routes, Next internals, static files and prefetch
 * requests so we do not pay for session work where it is not needed.
 */

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api/|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|css|js|txt|xml|json)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
