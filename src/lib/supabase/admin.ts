/**
 * Supabase ADMIN client — uses the service role key and bypasses RLS.
 *
 * Server-only by construction (`server-only` import): bundling it into a
 * Client Component is a build error. Callers are responsible for
 * authorization — always go through `src/lib/dal.ts` first.
 */

import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
