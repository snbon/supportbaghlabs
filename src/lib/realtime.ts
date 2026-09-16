"use client";

/**
 * Shared realtime subscription for the `tickets` table. Supabase enforces RLS
 * on the delivered rows, so clients only ever receive their own tickets.
 */

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { Ticket } from "@/lib/types";

export type TicketEvent =
  | { type: "INSERT"; ticket: Ticket }
  | { type: "UPDATE"; ticket: Ticket }
  | { type: "DELETE"; id: string };

export function useTicketChanges(onEvent: (e: TicketEvent) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`tickets-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, (payload) => {
        if (payload.eventType === "INSERT") onEvent({ type: "INSERT", ticket: payload.new as Ticket });
        else if (payload.eventType === "UPDATE") onEvent({ type: "UPDATE", ticket: payload.new as Ticket });
        else if (payload.eventType === "DELETE") onEvent({ type: "DELETE", id: (payload.old as { id: string }).id });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [onEvent, enabled]);
}

/** Apply an event to a ticket list, keeping newest-first order. */
export function applyTicketEvent(list: Ticket[], e: TicketEvent): Ticket[] {
  switch (e.type) {
    case "INSERT":
      return list.some((t) => t.id === e.ticket.id) ? list : [e.ticket, ...list];
    case "UPDATE":
      return list.map((t) => (t.id === e.ticket.id ? e.ticket : t));
    case "DELETE":
      return list.filter((t) => t.id !== e.id);
  }
}

/** Human-readable diff used by the notification banner. */
export function describeTicketChange(prev: Ticket, next: Ticket): string[] {
  const changes: string[] = [];
  if (prev.status !== next.status) changes.push(`Status changed to "${next.status}"`);
  const prevLabels = new Set(prev.labels ?? []);
  const nextLabels = new Set(next.labels ?? []);
  const added   = [...nextLabels].filter((l) => !prevLabels.has(l));
  const removed = [...prevLabels].filter((l) => !nextLabels.has(l));
  if (added.length)   changes.push(`Label${added.length > 1 ? "s" : ""} added: ${added.map((l) => `"${l}"`).join(", ")}`);
  if (removed.length) changes.push(`Label${removed.length > 1 ? "s" : ""} removed: ${removed.map((l) => `"${l}"`).join(", ")}`);
  return changes;
}
