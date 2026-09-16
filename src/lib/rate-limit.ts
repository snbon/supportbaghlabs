/**
 * Postgres-backed fixed-window rate limiter.
 *
 * In-memory limiters do not survive serverless cold starts, so counters live in
 * the `rate_limits` table and are consumed through the SECURITY DEFINER
 * function `consume_rate_limit` (see migration 20260916000000).
 */

import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Returns true when the request is allowed, false when the limit is exceeded.
 * Fails open on database errors so a DB hiccup cannot lock everyone out.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window: `${windowSeconds} seconds`,
  });
  if (error) {
    console.error("[rateLimit] rpc failed:", error.message);
    return true;
  }
  return data === true;
}

/** Best-effort client IP (Netlify header first, then X-Forwarded-For). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-nf-client-connection-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
