import Link from "next/link";
import { getSuperadminDashboardData } from "@/lib/dal";
import InviteClientDialog from "@/components/InviteClientDialog";
import SuperadminDashboardShell from "@/components/SuperadminDashboardShell";
import { Button } from "@/components/ui/button";
import SignOutButton from "@/components/SignOutButton";

export default async function SuperadminDashboard() {
  const profiles = await getSuperadminDashboardData();

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col bg-sidebar border-r border-sidebar-border fixed inset-y-0 left-0 z-30">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <BrandIcon />
            <span className="font-bold text-sm text-sidebar-foreground tracking-tight">Baghlabs</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <div className="px-3 py-2 rounded-xl bg-sidebar-accent flex items-center gap-2.5">
            <GridIcon className="text-sidebar-foreground shrink-0" />
            <span className="text-sm font-semibold text-sidebar-foreground">Dashboard</span>
          </div>
          <Link href="/profile" className="px-3 py-2 rounded-xl flex items-center gap-2.5 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
            <SettingsIcon className="shrink-0" />
            <span className="text-sm font-semibold">Settings</span>
          </Link>
        </nav>
        <div className="px-3 py-4 border-t border-sidebar-border">
          <SignOutButton className="w-full justify-start text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent gap-2 text-xs">
            <SignOutIcon /> Sign out
          </SignOutButton>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-56">
        <header className="sticky top-0 z-20 bg-card/95 border-b border-border/60 backdrop-blur-md">
          <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
            <div className="lg:hidden flex items-center gap-2">
              <BrandIcon />
              <span className="font-bold text-sm tracking-tight">Baghlabs</span>
            </div>
            <div className="hidden lg:block">
              <p className="font-semibold text-sm text-foreground">Overview</p>
              <p className="text-[11px] text-muted-foreground">Manage clients &amp; monitor tickets</p>
            </div>
            <div className="flex items-center gap-2">
              <InviteClientDialog />
              <div className="lg:hidden flex items-center gap-1">
                <Link href="/profile" aria-label="Account settings">
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground"><SettingsIcon /></Button>
                </Link>
                <SignOutButton className="text-muted-foreground text-xs" />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 py-6 space-y-6">
          <SuperadminDashboardShell profiles={profiles} />
        </main>
      </div>
    </div>
  );
}

function BrandIcon() {
  return (
    <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center shrink-0">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" className="text-brand-foreground" strokeWidth="1.5" strokeLinecap="round"/>
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
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
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
