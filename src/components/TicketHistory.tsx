"use client";

import { useState } from "react";
import type { Ticket } from "@/lib/types";
import TicketCard from "@/components/TicketCard";

interface TicketHistoryProps {
  tickets: Ticket[];
  onTicketClick: (ticket: Ticket) => void;
}

export default function TicketHistory({ tickets, onTicketClick }: TicketHistoryProps) {
  const [hideClosed, setHideClosed] = useState(false);

  const hasClosedTickets = tickets.some((t) => t.status === "closed");
  const visible = hideClosed ? tickets.filter((t) => t.status !== "closed") : tickets;

  return (
    <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-sm text-foreground">Ticket history</h3>
          <span className="text-xs text-muted-foreground">
            {visible.length}{hideClosed && tickets.length !== visible.length ? ` of ${tickets.length}` : ""} ticket{visible.length !== 1 ? "s" : ""}
          </span>
        </div>

        {hasClosedTickets && (
          <button
            onClick={() => setHideClosed((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[#BCCCDC] text-[#9AA6B2] hover:border-[#141f59]/30 hover:text-[#141f59] transition-colors"
          >
            {hideClosed ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                Show closed
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/>
                </svg>
                Hide closed
              </>
            )}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center px-6">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M12 12h.01M12 16h.01"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-foreground">
            {hideClosed ? "No open tickets" : "No tickets yet"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {hideClosed ? "All tickets are closed — toggle to show them" : "Submit your first ticket using the form"}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {visible.map((ticket) => (
            <div key={ticket.id} className="p-3">
              <TicketCard ticket={ticket} onClick={() => onTicketClick(ticket)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
