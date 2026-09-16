import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession, getClientDashboardData } from "@/lib/dal";
import { safeNext } from "@/lib/validation";
import LoginForm from "@/components/LoginForm";
import SuperadminDashboard from "@/components/SuperadminDashboard";
import ClientDashboard from "@/components/ClientDashboard";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import ThemeSync from "@/components/ThemeSync";

interface PageProps {
  searchParams: Promise<{ project?: string; token_hash?: string; type?: string; next?: string }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const { project, token_hash, type, next } = await searchParams;

  // Supabase sometimes redirects auth links to the site root; forward them.
  if (token_hash && type) {
    const params = new URLSearchParams({ token_hash, type, next: safeNext(next, "/set-password") });
    redirect(`/auth/callback?${params}`);
  }

  // Cookie + local JWT verification only — no database call before first paint.
  const session = await getSession();
  if (!session) return <LoginForm />;

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard userId={session.userId} email={session.email} defaultProjectId={project} />
    </Suspense>
  );
}

/** Streams in after one database round trip. */
async function Dashboard({
  userId, email, defaultProjectId,
}: { userId: string; email: string; defaultProjectId?: string }) {
  const data = await getClientDashboardData(userId);
  if (!data) return <LoginForm />;
  return (
    <>
      <ThemeSync theme={data.theme} />
      {data.is_superadmin
        ? <SuperadminDashboard />
        : <ClientDashboard data={data} email={email} defaultProjectId={defaultProjectId} />}
    </>
  );
}
