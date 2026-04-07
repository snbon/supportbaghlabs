"use client";

import { useState, useTransition } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import ClientDetailDialog from "@/components/ClientDetailDialog";
import { resendInvitation } from "@/actions/clients";
import type { ClientWithStats, Ticket } from "@/lib/types";

const COOLDOWN_MS = 60_000;

interface ClientTableProps {
  clients: ClientWithStats[];
  allTickets: Ticket[];
}

function Initials({ name }: { name: string }) {
  const i = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-[#D9EAFD] flex items-center justify-center shrink-0">
      <span className="text-[11px] font-extrabold text-[#141f59]">{i}</span>
    </div>
  );
}

function ResendButton({ email }: { email: string }) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent]     = useState(false);
  const [cooldown, setCooldown] = useState(0);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation(); // don't open the detail dialog
    if (isPending || cooldown > 0) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.append("email", email);
      await resendInvitation({}, fd);
      setSent(true);
      setCooldown(60);
      const interval = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) { clearInterval(interval); return 0; }
          return c - 1;
        });
      }, 1000);
    });
  }

  if (sent && cooldown > 0) {
    return (
      <span className="text-[11px] text-[#9AA6B2]">Sent · {cooldown}s</span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending || cooldown > 0}
      className="text-[11px] font-semibold text-[#141f59] border border-[#BCCCDC] rounded-lg px-2.5 py-1 hover:bg-[#D9EAFD] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {isPending ? "Sending…" : "Resend invite"}
    </button>
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
            className="w-full text-left bg-card border border-border/60 rounded-2xl px-4 py-4 flex items-center gap-3 hover:border-[#BCCCDC] active:scale-[0.99] transition-all"
          >
            <Initials name={c.profile.company_name} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-semibold text-sm text-foreground truncate">{c.profile.company_name}</p>
                {!c.emailVerified && (
                  <span className="shrink-0 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                    Unverified
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {c.projects.length} project{c.projects.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {c.openTicketCount > 0 && (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-100">
                  {c.openTicketCount} open
                </Badge>
              )}
              {!c.emailVerified && <ResendButton email={c.email} />}
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
              <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide py-3">Status</TableHead>
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
                    <div>
                      <p className="font-semibold text-sm text-foreground">{c.profile.company_name}</p>
                      <p className="text-[11px] text-muted-foreground">{c.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {c.emailVerified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                      Unverified
                    </span>
                  )}
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
                  <div className="flex items-center justify-end gap-3">
                    {!c.emailVerified && <ResendButton email={c.email} />}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </div>
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
