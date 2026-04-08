"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import type { Project, Ticket } from "@/lib/types";
import { createClient } from "@/lib/supabase/browser";
import { syncTicketStatuses } from "@/actions/tickets";
import ProjectSwitcher from "@/components/ProjectSwitcher";
import CreateTicketForm from "@/components/CreateTicketForm";
import TicketHistory from "@/components/TicketHistory";
import TicketDetailDialog from "@/components/TicketDetailDialog";
import RealtimeNotifier from "@/components/RealtimeNotifier";

interface Props {
  projects: Project[];
  tickets: Ticket[];
  initialProjectId: string;
  emailVerified: boolean;
}

export default function ClientDashboardShell({ projects, tickets, initialProjectId, emailVerified }: Props) {
  const router = useRouter();
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId);
  const [selectedTicket, setSelectedTicket]   = useState<Ticket | null>(null);
  const [liveTickets, setLiveTickets]         = useState<Ticket[]>(tickets);

  const allProjectIds = projects.map((p) => p.id);

  // Sync liveTickets when the server re-renders and passes fresh props
  // (happens after router.refresh() or page navigation)
  useEffect(() => {
    setLiveTickets(tickets);
  }, [tickets]);

  // Subscribe to ticket inserts + updates and keep liveTickets in sync
  useEffect(() => {
    if (allProjectIds.length === 0) return;
    const supabase = createClient();
    const channel = supabase
      .channel("shell-ticket-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tickets" },
        (payload) => {
          const inserted = payload.new as Ticket;
          if (!allProjectIds.includes(inserted.project_id)) return;
          setLiveTickets((prev) => [inserted, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tickets" },
        (payload) => {
          const updated = payload.new as Ticket;
          if (!allProjectIds.includes(updated.project_id)) return;
          setLiveTickets((prev) => prev.map((t) => t.id === updated.id ? updated : t));
          // Keep the open dialog in sync with the latest ticket data
          setSelectedTicket((sel) => sel?.id === updated.id ? updated : sel);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProjectIds.join(",")]);

  // Polling fallback: every 30s, sync ticket statuses from GitHub then refresh
  // the UI. This guarantees the dashboard stays accurate even if the webhook
  // misses events (e.g., reopened issues not updating).
  useEffect(() => {
    const id = setInterval(async () => {
      await syncTicketStatuses(allProjectIds);
      router.refresh();
    }, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, allProjectIds.join(",")]);

  const handleProjectChange = useCallback((id: string) => {
    setActiveProjectId(id);
    router.push(`?project=${id}`, { scroll: false });
  }, [router]);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeTickets = liveTickets.filter((t) => t.project_id === activeProjectId);

  const openCount   = liveTickets.filter((t) => t.status === "open").length;
  const closedCount = liveTickets.filter((t) => t.status !== "open").length;

  return (
    <>
      {/* Realtime notification banner — listens to all user projects */}
      <RealtimeNotifier projectIds={allProjectIds} initialTickets={liveTickets} />

      {/* Stat cards — computed from live ticket state */}
      <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-up">
        {[
          { label: "Total",  value: liveTickets.length, color: "text-foreground",       dot: "bg-slate-400" },
          { label: "Open",   value: openCount,           color: "text-emerald-600",      dot: "bg-emerald-500" },
          { label: "Closed", value: closedCount,         color: "text-muted-foreground", dot: "bg-slate-300" },
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

      <div className="space-y-5">
        <Suspense>
          <ProjectSwitcher
            projects={projects}
            activeProjectId={activeProjectId}
            onProjectChange={handleProjectChange}
          />
        </Suspense>

        <div className="flex flex-col lg:flex-row gap-5 items-start">
          <div className="w-full lg:w-80 shrink-0 animate-fade-up stagger-2">
            <CreateTicketForm
              projectId={activeProjectId}
              projectName={activeProject?.project_name}
              disabled={!emailVerified}
            />
          </div>
          <div className="w-full min-w-0 animate-fade-up stagger-3">
            <TicketHistory
              tickets={activeTickets}
              onTicketClick={setSelectedTicket}
            />
          </div>
        </div>
      </div>

      {/* Ticket detail modal — passes full project for GitHub API */}
      {selectedTicket && (
        <TicketDetailDialog
          ticket={selectedTicket}
          project={projects.find((p) => p.id === selectedTicket.project_id)}
          open={!!selectedTicket}
          onOpenChange={(open) => !open && setSelectedTicket(null)}
        />
      )}
    </>
  );
}
