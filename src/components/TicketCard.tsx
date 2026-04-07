import { Badge } from "@/components/ui/badge";
import type { Ticket } from "@/lib/types";

interface TicketCardProps {
  ticket: Ticket;
  onClick?: () => void;
}

function StatusDot({ status }: { status: string }) {
  if (status.toLowerCase() === "open") return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  );
  if (status.toLowerCase() === "closed") return (
    <span className="h-2 w-2 rounded-full bg-slate-300 inline-flex shrink-0" />
  );
  return <span className="h-2 w-2 rounded-full bg-amber-400 inline-flex shrink-0" />;
}

function statusClasses(s: string) {
  switch (s.toLowerCase()) {
    case "open":        return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "closed":      return "bg-slate-100 text-slate-500 border-slate-200";
    case "in_progress": return "bg-blue-50 text-blue-700 border-blue-100";
    default:            return "bg-amber-50 text-amber-700 border-amber-100";
  }
}

export default function TicketCard({ ticket, onClick }: TicketCardProps) {
  const label = ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1).replace(/_/g, " ");

  return (
    <button
      onClick={onClick}
      className="w-full text-left group bg-card border border-border/60 rounded-2xl px-4 py-3.5
        hover:border-[#BCCCDC] hover:shadow-sm active:scale-[0.995]
        transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9EAFD]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-1.5">
            <StatusDot status={ticket.status} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground leading-snug line-clamp-1 group-hover:text-[#141f59] transition-colors">
              {ticket.title}
            </p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">
              {ticket.description}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 shrink-0">
          <Badge variant="outline" className={`text-xs border font-semibold ${statusClasses(ticket.status)}`}>
            {label}
          </Badge>
          {/* Chevron affordance */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="text-muted-foreground/40 group-hover:text-[#141f59]/50 transition-colors mt-0.5 shrink-0">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      </div>

      {ticket.labels && ticket.labels.length > 0 && (
        <div className="mt-2.5 ml-5 flex flex-wrap gap-1.5">
          {ticket.labels.map((l) => (
            <span key={l} className="inline-flex items-center text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {l}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
