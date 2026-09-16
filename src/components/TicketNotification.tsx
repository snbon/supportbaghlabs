"use client";

/**
 * Slide-down banner announcing a ticket change (presentational; the dashboard
 * shell owns the realtime subscription and decides when to show it).
 */

import { useEffect, useState } from "react";

export interface TicketNotificationData {
  id: string;
  ticketTitle: string;
  changes: string[];
}

interface Props {
  notification: TicketNotificationData | null;
  onDismiss: () => void;
}

export default function TicketNotification({ notification, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!notification) return;
    const show = setTimeout(() => setVisible(true), 10);
    const hide = setTimeout(() => setVisible(false), 7000);
    const clear = setTimeout(onDismiss, 7300);
    return () => { clearTimeout(show); clearTimeout(hide); clearTimeout(clear); };
  }, [notification, onDismiss]);

  if (!notification) return null;

  return (
    <div
      role="status"
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 transition-all duration-300
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3 pointer-events-none"}`}
    >
      <div className="bg-sidebar border border-sidebar-border text-sidebar-foreground rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-0.5 bg-sidebar-foreground/20">
          <div key={notification.id} className="h-full bg-sidebar-foreground/60 origin-left animate-drain" />
        </div>
        <div className="px-4 py-3.5 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sidebar-foreground/60">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wide mb-0.5">Ticket update</p>
            <p className="text-sm font-bold leading-snug truncate">{notification.ticketTitle}</p>
            <ul className="mt-1 space-y-0.5">
              {notification.changes.map((c, i) => (
                <li key={i} className="text-xs text-sidebar-foreground/70 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-sidebar-foreground/40 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
            className="text-sidebar-foreground/30 hover:text-sidebar-foreground/70 transition-colors shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
