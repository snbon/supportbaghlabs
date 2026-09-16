import Link from "next/link";
import { stripTickets, type ProfileWithProjects, type Project, type Ticket } from "@/lib/types";
import ClientDashboardShell from "@/components/ClientDashboardShell";
import VerificationBanner from "@/components/VerificationBanner";
import SignOutButton from "@/components/SignOutButton";

interface ClientDashboardProps {
  data: ProfileWithProjects;
  email: string;
  defaultProjectId?: string;
}

export default function ClientDashboard({ data, email, defaultProjectId }: ClientDashboardProps) {
  const projects: Project[] = data.projects.map(stripTickets);
  const tickets: Ticket[] = data.projects
    .flatMap((p) => p.tickets)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const emailVerified = data.email_verified;
  const userEmail = data.email ?? email;

  const validProjectId =
    projects.find((p) => p.id === defaultProjectId)?.id ?? projects[0]?.id ?? "";

  const initials = data.company_name
    ? data.company_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 bg-card/95 border-b border-border/60 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" className="text-brand-foreground" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-bold text-sm text-foreground truncate">
              {data.company_name || "Support Portal"}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/profile" title="Account settings" aria-label="Account settings">
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/70 transition-colors cursor-pointer">
                <span className="text-[10px] font-extrabold text-secondary-foreground">{initials}</span>
              </div>
            </Link>
            <SignOutButton className="text-muted-foreground text-xs" />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">
        {!emailVerified && <VerificationBanner email={userEmail} />}
        {projects.length === 0 ? (
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
          <ClientDashboardShell
            projects={projects}
            tickets={tickets}
            initialProjectId={validProjectId}
            emailVerified={emailVerified}
          />
        )}
      </main>
    </div>
  );
}
