"use client";

/**
 * RealtimeNotifier — subscribes to Supabase Realtime changes on the
 * user's tickets and surfaces a slide-down notification banner when
 * anything changes (status, labels) — like a social media activity bar.
 *
 * Subscribes once on mount, cleans up on unmount.
 */

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/browser";
import type { Ticket } from "@/lib/types";

interface Notification {
  id: string;         // unique per notification event
  ticketTitle: string;
  changes: string[];  // human-readable description of what changed
}

interface RealtimeNotifierProps {
  projectIds: string[];
  /** Snapshot of tickets at render time — used to diff against incoming changes */
  initialTickets: Ticket[];
}

function diffTicket(prev: Ticket, next: Ticket): string[] {
  const changes: string[] = [];
  if (prev.status !== next.status) {
    changes.push(`Status changed to "${next.status}"`);
  }
  const prevLabels = new Set(prev.labels ?? []);
  const nextLabels = new Set(next.labels ?? []);
  const added   = [...nextLabels].filter((l) => !prevLabels.has(l));
  const removed = [...prevLabels].filter((l) => !nextLabels.has(l));
  if (added.length)   changes.push(`Label${added.length > 1 ? "s" : ""} added: ${added.map((l) => `"${l}"`).join(", ")}`);
  if (removed.length) changes.push(`Label${removed.length > 1 ? "s" : ""} removed: ${removed.map((l) => `"${l}"`).join(", ")}`);
  return changes;
}

export default function RealtimeNotifier({ projectIds, initialTickets }: RealtimeNotifierProps) {
  const [notification, setNotification] = useState<Notification | null>(null);
  const [visible, setVisible] = useState(false);
  // Keep a mutable map of ticket state for diffing — starts from server-rendered data
  const [ticketMap, setTicketMap] = useState<Map<string, Ticket>>(
    () => new Map(initialTickets.map((t) => [t.id, t]))
  );

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => setNotification(null), 300); // wait for exit animation
  }, []);

  // Auto-dismiss after 7s
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(dismiss, 7000);
    return () => clearTimeout(timer);
  }, [notification, dismiss]);

  useEffect(() => {
    if (projectIds.length === 0) return;

    const supabase = createClient();

    const channel = supabase
      .channel("ticket-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tickets",
        },
        (payload) => {
          const updated = payload.new as Ticket;

          // Only care about tickets that belong to this user's projects
          if (!projectIds.includes(updated.project_id)) return;

          const prev = ticketMap.get(updated.id);
          const changes = prev ? diffTicket(prev, updated) : ["Ticket updated"];

          if (changes.length > 0) {
            setTicketMap((m) => new Map(m).set(updated.id, updated));
            setNotification({
              id:          `${updated.id}-${Date.now()}`,
              ticketTitle: updated.title,
              changes,
            });
            setVisible(true);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIds.join(",")]);

  if (!notification) return null;

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 transition-all duration-300
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3 pointer-events-none"}`}
    >
      <div className="bg-[var(--sidebar)] border border-white/10 text-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress bar that drains over 7s */}
        <div className="h-0.5 bg-indigo-500/40">
          <div
            key={notification.id}
            className="h-full bg-indigo-400 origin-left"
            style={{ animation: "drain 7s linear forwards" }}
          />
        </div>

        <div className="px-4 py-3.5 flex items-start gap-3">
          {/* Bell icon */}
          <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center shrink-0 mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-300">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-0.5">Ticket update</p>
            <p className="text-sm font-bold text-white leading-snug truncate">{notification.ticketTitle}</p>
            <ul className="mt-1 space-y-0.5">
              {notification.changes.map((c, i) => (
                <li key={i} className="text-xs text-white/70 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-indigo-400 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={dismiss}
            className="text-white/30 hover:text-white/70 transition-colors shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Drain animation keyframe — defined inline to avoid globals */}
      <style>{`@keyframes drain { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
    </div>
  );
}
