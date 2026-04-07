"use client";

import { useState, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import type { Project, Ticket } from "@/lib/types";
import ProjectSwitcher from "@/components/ProjectSwitcher";
import CreateTicketForm from "@/components/CreateTicketForm";
import TicketHistory from "@/components/TicketHistory";
import TicketDetailDialog from "@/components/TicketDetailDialog";
import RealtimeNotifier from "@/components/RealtimeNotifier";

interface Props {
  projects: Project[];
  tickets: Ticket[];
  initialProjectId: string;
}

export default function ClientDashboardShell({ projects, tickets, initialProjectId }: Props) {
  const router = useRouter();
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId);
  const [selectedTicket, setSelectedTicket]   = useState<Ticket | null>(null);

  const handleProjectChange = useCallback((id: string) => {
    setActiveProjectId(id);
    router.push(`?project=${id}`, { scroll: false });
  }, [router]);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeTickets = tickets.filter((t) => t.project_id === activeProjectId);
  const allProjectIds = projects.map((p) => p.id);

  return (
    <>
      {/* Realtime notification banner — listens to all user projects */}
      <RealtimeNotifier projectIds={allProjectIds} initialTickets={tickets} />

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
