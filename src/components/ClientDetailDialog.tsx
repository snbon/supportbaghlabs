"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Profile, Project, Ticket } from "@/lib/types";
import TicketCard from "@/components/TicketCard";
import AddProjectDialog from "@/components/AddProjectDialog";

interface ClientDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  projects: Project[];
  tickets: Ticket[];
}

export default function ClientDetailDialog({ open, onOpenChange, profile, projects, tickets }: ClientDetailDialogProps) {
  const openCount = tickets.filter((t) => t.status === "open").length;

  const initials = profile.company_name
    .split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#D9EAFD] flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-[#141f59]">{initials}</span>
              </div>
              <div>
                <DialogTitle className="text-base">{profile.company_name}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {projects.length} project{projects.length !== 1 ? "s" : ""} ·{" "}
                  {openCount > 0 ? (
                    <span className="text-emerald-600 font-medium">{openCount} open</span>
                  ) : "no open tickets"}
                </p>
              </div>
            </div>
            <AddProjectDialog clientId={profile.id} clientName={profile.company_name} />
          </div>
        </DialogHeader>

        {/* Projects */}
        <section className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Projects</p>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {projects.map((p) => {
                const pOpen = tickets.filter((t) => t.project_id === p.id && t.status === "open").length;
                return (
                  <div key={p.id} className="flex items-center gap-2 bg-muted/50 border border-border/60 rounded-xl px-3 py-2">
                    <span className="text-sm font-medium text-foreground">{p.project_name}</span>
                    <code className="text-xs text-muted-foreground">{p.github_repo}</code>
                    {pOpen > 0 && (
                      <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-100">
                        {pOpen}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Tickets */}
        <section className="mt-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Ticket history ({tickets.length})
          </p>
          {tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tickets yet.</p>
          ) : (
            <div className="space-y-2">
              {tickets.map((ticket) => {
                const proj = projects.find((p) => p.id === ticket.project_id);
                return (
                  <div key={ticket.id}>
                    {proj && (
                      <p className="text-[11px] text-muted-foreground mb-1 ml-1">{proj.project_name}</p>
                    )}
                    <TicketCard ticket={ticket} />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
