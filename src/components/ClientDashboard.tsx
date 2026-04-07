import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Project, Ticket } from "@/lib/types";
import ClientDashboardShell from "@/components/ClientDashboardShell";
import VerificationBanner from "@/components/VerificationBanner";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";

interface ClientDashboardProps {
  userId: string;
  defaultProjectId?: string;
}

export default async function ClientDashboard({ userId, defaultProjectId }: ClientDashboardProps) {
  const supabase = createAdminClient();

  // Check if the user's email is verified
  const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);
  const emailVerified = !!authUser?.email_confirmed_at;
  const userEmail = authUser?.email ?? "";

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("id", userId).single<Profile>();

  const { data: projects } = await supabase
    .from("projects").select("*").eq("client_id", userId).order("project_name");

  const safeProjects: Project[] = projects || [];
  let tickets: Ticket[] = [];

  if (safeProjects.length > 0) {
    const { data: td } = await supabase
      .from("tickets").select("*")
      .in("project_id", safeProjects.map((p) => p.id))
      .order("created_at", { ascending: false });
    tickets = (td as Ticket[]) || [];
  }

  // Resolve initial project: URL param → first project
  const validProjectId = safeProjects.find((p) => p.id === defaultProjectId)?.id
    ?? safeProjects[0]?.id
    ?? "";

  const initials = profile?.company_name
    ? profile.company_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const openCount   = tickets.filter((t) => t.status === "open").length;
  const closedCount = tickets.filter((t) => t.status !== "open").length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 bg-card/95 border-b border-border/60 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#141f59] flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h8M2 12h10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-bold text-sm text-foreground truncate">
              {profile?.company_name || "Support Portal"}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-full bg-[#D9EAFD] flex items-center justify-center">
              <span className="text-[10px] font-extrabold text-[#141f59]">{initials}</span>
            </div>
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground text-xs">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">
        {!emailVerified && <VerificationBanner email={userEmail} />}
        {safeProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-up px-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <h2 className="text-lg font-bold text-foreground">No projects yet</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-xs">
              Your account manager will assign projects shortly. Check back soon.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-up">
              {[
                { label: "Total",  value: tickets.length, color: "text-foreground",       dot: "bg-slate-400" },
                { label: "Open",   value: openCount,       color: "text-emerald-600",      dot: "bg-emerald-500" },
                { label: "Closed", value: closedCount,     color: "text-muted-foreground", dot: "bg-slate-300" },
              ].map((s, i) => (
                <div key={s.label}
                  className={`bg-card border border-border/60 rounded-2xl px-4 py-3.5 stagger-${i + 1} animate-fade-up`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  </div>
                  <p className={`text-2xl sm:text-3xl font-extrabold leading-none ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            <ClientDashboardShell
              projects={safeProjects}
              tickets={tickets}
              initialProjectId={validProjectId}
              emailVerified={emailVerified}
            />
          </>
        )}
      </main>
    </div>
  );
}
