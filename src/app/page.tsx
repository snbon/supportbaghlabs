import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import LoginForm from "@/components/LoginForm";
import SuperadminDashboard from "@/components/SuperadminDashboard";
import ClientDashboard from "@/components/ClientDashboard";
import type { Profile } from "@/lib/types";
import { redirect } from "next/navigation";

// searchParams is a Promise in Next.js 15
interface PageProps {
  searchParams: Promise<{ project?: string; token_hash?: string; type?: string; next?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const { project: defaultProjectId, token_hash, type, next } = await searchParams;

  // Supabase sometimes redirects back to the site root instead of /auth/callback
  // (e.g. when the redirect URL isn't in the allowlist). Forward to the handler.
  if (token_hash && type) {
    const nextPath = next ?? "/set-password";
    redirect(`/auth/callback?token_hash=${token_hash}&type=${type}&next=${nextPath}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return <LoginForm />;

  const adminSupabase = createAdminClient();
  const { data: profile } = await adminSupabase
    .from("profiles").select("*").eq("id", user.id).single<Profile>();

  if (profile?.is_superadmin) return <SuperadminDashboard />;

  return <ClientDashboard userId={user.id} defaultProjectId={defaultProjectId} />;
}
