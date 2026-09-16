/**
 * Next.js Proxy (formerly Middleware) — runs before rendering for matched paths.
 *
 * Responsibilities (and nothing more):
 *  1. refresh the Supabase auth cookies so Server Components see a live session
 *  2. generate a per-request CSP nonce and attach the Content-Security-Policy
 *
 * It is not an authorization boundary: every server action and route handler
 * authenticates through `src/lib/dal.ts`.
 */

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { buildCsp, CSP_HEADER } from "@/lib/csp";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // Forwarded to the render so Next can tag its own scripts with the nonce.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(CSP_HEADER.toLowerCase(), csp);

  const response = await updateSession(request, requestHeaders);
  response.headers.set(CSP_HEADER, csp);
  return response;
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
