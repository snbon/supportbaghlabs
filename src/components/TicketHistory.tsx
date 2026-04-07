import type { Ticket } from "@/lib/types";
import TicketCard from "@/components/TicketCard";

interface TicketHistoryProps {
  tickets: Ticket[];
  onTicketClick: (ticket: Ticket) => void;
}

export default function TicketHistory({ tickets, onTicketClick }: TicketHistoryProps) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
        <h3 className="font-bold text-sm text-foreground">Ticket history</h3>
        <span className="text-xs text-muted-foreground">{tickets.length} ticket{tickets.length !== 1 ? "s" : ""}</span>
      </div>

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center px-6">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M12 12h.01M12 16h.01"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-foreground">No tickets yet</p>
          <p className="text-xs text-muted-foreground mt-1">Submit your first ticket using the form</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="p-3">
              <TicketCard ticket={ticket} onClick={() => onTicketClick(ticket)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
