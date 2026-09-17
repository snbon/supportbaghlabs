"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { stripTickets, type ClientWithStats, type ProfileWithProjects, type Ticket } from "@/lib/types";
import { applyTicketEvent, useTicketChanges, type TicketEvent } from "@/lib/realtime";
import ClientTable from "@/components/ClientTable";

interface Props {
  profiles: ProfileWithProjects[];
}

/** Stats + client table, kept live through the tickets realtime channel. */
export default function SuperadminDashboardShell({ profiles }: Props) {
  const initialTickets = useMemo(
    () => profiles.flatMap((p) => p.projects.flatMap((pr) => pr.tickets))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [profiles]
  );
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  useEffect(() => { setTickets(initialTickets); }, [initialTickets]);

  const projectIdKey = profiles.flatMap((p) => p.projects.map((pr) => pr.id)).join(",");
  const onEvent = useCallback((e: TicketEvent) => {
    const own = new Set(projectIdKey.split(","));
    if (e.type !== "DELETE" && !own.has(e.ticket.project_id)) return;
    setTickets((prev) => applyTicketEvent(prev, e));
  }, [projectIdKey]);
  useTicketChanges(onEvent);

  const clients: ClientWithStats[] = profiles.map((profile) => {
    const projects = profile.projects.map(stripTickets);
    const ids = new Set(projects.map((p) => p.id));
    const own = tickets.filter((t) => ids.has(t.project_id));
    return {
      profile,
      projects,
      openTicketCount: own.filter((t) => t.status === "open").length,
      totalTicketCount: own.length,
      emailVerified: profile.email_verified,
      email: profile.email ?? "",
    };
  });

  const projectCount = profiles.reduce((n, p) => n + p.projects.length, 0);
  const totalOpen = tickets.filter((t) => t.status === "open").length;
  const stats = [
    { label: "Clients",        value: profiles.length,             sub: "active",   dot: "bg-brand" },
    { label: "Open tickets",   value: totalOpen,                   sub: "pending",  dot: "bg-success" },
    { label: "Closed tickets", value: tickets.length - totalOpen,  sub: "resolved", dot: "bg-muted-foreground" },
    { label: "Projects",       value: projectCount,                sub: "total",    dot: "bg-brand/70" },
  ];

  return (
    <>
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

      <div className="animate-fade-up stagger-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm text-foreground">All clients</h2>
          <p className="text-xs text-muted-foreground hidden sm:block">Tap a row to view details</p>
        </div>
        <ClientTable clients={clients} allTickets={tickets} />
      </div>
    </>
  );
}
