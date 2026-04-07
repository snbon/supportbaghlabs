"use client";

import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import ClientDetailDialog from "@/components/ClientDetailDialog";
import type { ClientWithStats, Ticket } from "@/lib/types";

interface ClientTableProps {
  clients: ClientWithStats[];
  allTickets: Ticket[];
}

function Initials({ name }: { name: string }) {
  const i = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
      <span className="text-[11px] font-extrabold text-indigo-700">{i}</span>
    </div>
  );
}

export default function ClientTable({ clients, allTickets }: ClientTableProps) {
  const [selected, setSelected] = useState<ClientWithStats | null>(null);

  if (clients.length === 0) {
    return (
      <div className="bg-card border border-border/60 rounded-2xl flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
          </svg>
        </div>
        <p className="text-sm font-semibold text-foreground">No clients yet</p>
        <p className="text-xs text-muted-foreground mt-1">Use &quot;+ Invite client&quot; to get started</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile card list ──────────────────────────────────── */}
      <div className="sm:hidden space-y-3">
        {clients.map((c) => (
          <button
            key={c.profile.id}
            onClick={() => setSelected(c)}
            className="w-full text-left bg-card border border-border/60 rounded-2xl px-4 py-4 flex items-center gap-3 hover:border-indigo-200 active:scale-[0.99] transition-all"
          >
            <Initials name={c.profile.company_name} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{c.profile.company_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c.projects.length} project{c.projects.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {c.openTicketCount > 0 && (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-100">
                  {c.openTicketCount} open
                </Badge>
              )}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* ── Desktop table ─────────────────────────────────────── */}
      <div className="hidden sm:block bg-card border border-border/60 rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide pl-5 py-3">Company</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide py-3">Projects</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide py-3">Open</TableHead>
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide py-3">Total</TableHead>
              <TableHead className="pr-5 py-3" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((c) => (
              <TableRow
                key={c.profile.id}
                className="cursor-pointer border-border/40 hover:bg-muted/30 transition-colors"
                onClick={() => setSelected(c)}
              >
                <TableCell className="pl-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Initials name={c.profile.company_name} />
                    <span className="font-semibold text-sm text-foreground">{c.profile.company_name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.projects.length}</TableCell>
                <TableCell>
                  {c.openTicketCount > 0 ? (
                    <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-100 font-semibold">
                      {c.openTicketCount} open
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.totalTicketCount}</TableCell>
                <TableCell className="pr-5 text-right">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground inline-block">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selected && (
        <ClientDetailDialog
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          profile={selected.profile}
          projects={selected.projects}
          tickets={allTickets.filter((t) => selected.projects.some((p) => p.id === t.project_id))}
        />
      )}
    </>
  );
}
