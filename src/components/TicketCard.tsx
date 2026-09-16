import { Badge } from "@/components/ui/badge";
import type { Ticket } from "@/lib/types";

interface TicketCardProps {
  ticket: Ticket;
  onClick?: () => void;
}

function StatusDot({ status }: { status: string }) {
  if (status.toLowerCase() === "open") return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
    </span>
  );
  if (status.toLowerCase() === "closed") return (
    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 inline-flex shrink-0" />
  );
  return <span className="h-2 w-2 rounded-full bg-warning inline-flex shrink-0" />;
}

function statusClasses(s: string) {
  switch (s.toLowerCase()) {
    case "open":        return "bg-success-soft text-success border-success/20";
    case "closed":      return "bg-muted text-muted-foreground border-border";
    case "in_progress": return "bg-info-soft text-info border-info/20";
    default:            return "bg-warning-soft text-warning border-warning/20";
  }
}

export default function TicketCard({ ticket, onClick }: TicketCardProps) {
  const label = ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1).replace(/_/g, " ");

  return (
    <button
      onClick={onClick}
      className="w-full text-left group bg-card border border-border/60 rounded-2xl px-4 py-3.5
        hover:border-input hover:shadow-sm active:scale-[0.995]
        transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-1.5">
            <StatusDot status={ticket.status} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground leading-snug line-clamp-1 group-hover:text-primary transition-colors">
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
            className="text-muted-foreground/40 group-hover:text-primary/60 transition-colors mt-0.5 shrink-0">
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
