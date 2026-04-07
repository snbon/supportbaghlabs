/**
 * Supabase ADMIN client — uses the service role key.
 *
 * SECURITY: This client bypasses Row Level Security completely.
 * Use ONLY in:
 *   - Server Actions that require admin privileges (inviting users)
 *   - API route handlers that receive verified webhooks
 *
 * Never import this in Client Components or expose it to the browser.
 * The service role key MUST stay server-side only.
 */

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        // Disable auto-refreshing; admin client is stateless per request
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
