import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import LoginForm from "@/components/LoginForm";
import SuperadminDashboard from "@/components/SuperadminDashboard";
import ClientDashboard from "@/components/ClientDashboard";
import type { Profile } from "@/lib/types";

// searchParams is a Promise in Next.js 15
interface PageProps {
  searchParams: Promise<{ project?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const { project: defaultProjectId } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return <LoginForm />;

  const adminSupabase = createAdminClient();
  const { data: profile } = await adminSupabase
    .from("profiles").select("*").eq("id", user.id).single<Profile>();

  if (profile?.is_superadmin) return <SuperadminDashboard />;

  return <ClientDashboard userId={user.id} defaultProjectId={defaultProjectId} />;
}
