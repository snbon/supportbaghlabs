"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Project, Ticket } from "@/lib/types";
import { applyTicketEvent, describeTicketChange, useTicketChanges, type TicketEvent } from "@/lib/realtime";
import ProjectSwitcher from "@/components/ProjectSwitcher";
import CreateTicketForm from "@/components/CreateTicketForm";
import TicketHistory from "@/components/TicketHistory";
import TicketNotification, { type TicketNotificationData } from "@/components/TicketNotification";

const TicketDetailDialog = dynamic(() => import("@/components/TicketDetailDialog"));

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
  const [notification, setNotification]       = useState<TicketNotificationData | null>(null);

  const projectIdKey = projects.map((p) => p.id).join(",");

  // Latest list, readable from the realtime callback without stale closures.
  const liveRef = useRef(liveTickets);
  useEffect(() => { liveRef.current = liveTickets; }, [liveTickets]);

  // Adopt fresh server data after a navigation / server action.
  useEffect(() => { setLiveTickets(tickets); }, [tickets]);

  const onEvent = useCallback((e: TicketEvent) => {
    const ownProjects = new Set(projectIdKey.split(","));
    if (e.type !== "DELETE" && !ownProjects.has(e.ticket.project_id)) return;

    if (e.type === "UPDATE") {
      const before = liveRef.current.find((t) => t.id === e.ticket.id);
      const changes = before ? describeTicketChange(before, e.ticket) : [];
      if (changes.length) {
        setNotification({ id: `${e.ticket.id}-${Date.now()}`, ticketTitle: e.ticket.title, changes });
      }
      setSelectedTicket((sel) => (sel?.id === e.ticket.id ? e.ticket : sel));
    }
    setLiveTickets((prev) => applyTicketEvent(prev, e));
  }, [projectIdKey]);

  useTicketChanges(onEvent, projects.length > 0);

  const dismissNotification = useCallback(() => setNotification(null), []);

  const handleProjectChange = useCallback((id: string) => {
    setActiveProjectId(id);
    router.replace(`?project=${id}`, { scroll: false });
  }, [router]);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeTickets = liveTickets.filter((t) => t.project_id === activeProjectId);
  const openCount   = liveTickets.filter((t) => t.status === "open").length;
  const closedCount = liveTickets.length - openCount;

  return (
    <>
      <TicketNotification notification={notification} onDismiss={dismissNotification} />

      <div className="grid grid-cols-3 gap-3 mb-6 animate-fade-up">
        {[
          { label: "Total",  value: liveTickets.length, color: "text-foreground",       dot: "bg-muted-foreground" },
          { label: "Open",   value: openCount,           color: "text-success",          dot: "bg-success" },
          { label: "Closed", value: closedCount,         color: "text-muted-foreground", dot: "bg-border" },
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
            <TicketHistory tickets={activeTickets} onTicketClick={setSelectedTicket} />
          </div>
        </div>
      </div>

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
