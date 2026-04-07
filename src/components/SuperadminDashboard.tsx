import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, Project, Ticket, ClientWithStats } from "@/lib/types";
import ClientTable from "@/components/ClientTable";
import InviteClientDialog from "@/components/InviteClientDialog";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export default async function SuperadminDashboard() {
  const supabase = createAdminClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_superadmin", false)
    .order("company_name");

  const safeProfiles: Profile[] = profiles || [];

  // Fetch auth users to get email + verification status
  const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  let projects: Project[] = [];
  let tickets: Ticket[] = [];

  if (safeProfiles.length > 0) {
    const { data: pd } = await supabase
      .from("projects")
      .select("*")
      .in("client_id", safeProfiles.map((p) => p.id))
      .order("project_name");
    projects = (pd as Project[]) || [];

    if (projects.length > 0) {
      const { data: td } = await supabase
        .from("tickets")
        .select("*")
        .in("project_id", projects.map((p) => p.id))
        .order("created_at", { ascending: false });
      tickets = (td as Ticket[]) || [];
    }
  }

  const clients: ClientWithStats[] = safeProfiles.map((profile) => {
    const cp = projects.filter((p) => p.client_id === profile.id);
    const ct = tickets.filter((t) => cp.some((p) => p.id === t.project_id));
    const authUser = authUsers?.find((u) => u.id === profile.id);
    return {
      profile,
      projects: cp,
      openTicketCount: ct.filter((t) => t.status === "open").length,
      totalTicketCount: ct.length,
      emailVerified: !!authUser?.email_confirmed_at,
      email: authUser?.email ?? "",
    };
  });

  const totalOpen   = tickets.filter((t) => t.status === "open").length;
  const totalClosed = tickets.filter((t) => t.status === "closed").length;

  const stats = [
    { label: "Clients",        value: safeProfiles.length, sub: "active",   dot: "bg-[#141f59]"  },
    { label: "Open tickets",   value: totalOpen,            sub: "pending",  dot: "bg-emerald-500" },
    { label: "Closed tickets", value: totalClosed,          sub: "resolved", dot: "bg-slate-400"   },
    { label: "Projects",       value: projects.length,      sub: "total",    dot: "bg-[#141f59]/70"  },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">

      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col bg-[var(--sidebar)] border-r border-[var(--sidebar-border)] fixed inset-y-0 left-0 z-30">
        <div className="px-5 py-5 border-b border-[var(--sidebar-border)]">
          <div className="flex items-center gap-2.5">
            <BrandIcon />
            <span className="font-bold text-sm text-[var(--sidebar-foreground)] tracking-tight">Baghlabs</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4">
          <div className="px-3 py-2 rounded-xl bg-[var(--sidebar-accent)] flex items-center gap-2.5">
            <GridIcon className="text-[var(--sidebar-foreground)] shrink-0" />
            <span className="text-sm font-semibold text-[var(--sidebar-foreground)]">Dashboard</span>
          </div>
        </nav>
        <div className="px-3 py-4 border-t border-[var(--sidebar-border)]">
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit"
              className="w-full justify-start text-[var(--sidebar-foreground)]/50 hover:text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] gap-2 text-xs">
              <SignOutIcon /> Sign out
            </Button>
          </form>
        </div>
      </aside>

      {/* ── Main (offset for desktop sidebar) ──────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-56">

        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-card/95 border-b border-border/60 backdrop-blur-md">
          <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
            {/* Mobile brand */}
            <div className="lg:hidden flex items-center gap-2">
              <BrandIcon />
              <span className="font-bold text-sm tracking-tight">Baghlabs</span>
            </div>
            {/* Desktop title */}
            <div className="hidden lg:block">
              <p className="font-semibold text-sm text-foreground">Overview</p>
              <p className="text-[11px] text-muted-foreground">Manage clients &amp; monitor tickets</p>
            </div>

            <div className="flex items-center gap-2">
              <InviteClientDialog />
              {/* Mobile sign-out */}
              <div className="lg:hidden">
                <form action={logout}>
                  <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground text-xs">
                    Sign out
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 py-6 space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map((s, i) => (
              <div key={s.label}
                className={`bg-card border border-border/60 rounded-2xl px-4 py-4 animate-fade-up stagger-${i + 1}`}>
                <div className="flex items-center gap-1.5 mb-3">
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{s.label}</p>
                </div>
                <p className="text-3xl font-extrabold text-foreground leading-none">{s.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Client table */}
          <div className="animate-fade-up stagger-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm text-foreground">All clients</h2>
              <p className="text-xs text-muted-foreground hidden sm:block">Tap a row to view details</p>
            </div>
            <ClientTable clients={clients} allTickets={tickets} />
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── Icon components (inline SVG avoids extra deps) ──────────── */
function BrandIcon() {
  return (
    <div className="w-7 h-7 rounded-lg bg-[#141f59] flex items-center justify-center shrink-0">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12M2 8h8M2 12h10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
  );
}
function GridIcon({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}
function SignOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
    </svg>
  );
}
