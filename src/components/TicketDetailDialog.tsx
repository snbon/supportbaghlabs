"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import CommentForm from "@/components/CommentForm";
import { syncTicketStatus } from "@/actions/tickets";
import type { Ticket, Project } from "@/lib/types";

interface GHComment {
  id: number;
  body: string;
  created_at: string;
  author: string;
  avatar: string | null;
}

interface GHData {
  labels: { name: string; color: string }[];
  state: string;
  comments: GHComment[];
}

interface TicketDetailDialogProps {
  ticket: Ticket;
  project?: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function statusClasses(s: string) {
  switch (s.toLowerCase()) {
    case "open":        return "bg-success-soft text-success border-success/20";
    case "closed":      return "bg-muted text-muted-foreground border-border";
    case "in_progress": return "bg-info-soft text-info border-info/20";
    default:            return "bg-warning-soft text-warning border-warning/20";
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

type ActivityState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: GHData };

/** Loads GitHub activity for a ticket. Remounted (via key) to re-fetch. */
function useGitHubActivity(ticket: Ticket, enabled: boolean): ActivityState {
  const linked = enabled && !!ticket.github_issue_number;
  const [state, setState] = useState<ActivityState>(linked ? { status: "loading" } : { status: "idle" });

  useEffect(() => {
    if (!linked) return;
    let cancelled = false;
    fetch(`/api/github-comments?ticketId=${encodeURIComponent(ticket.id)}`)
      .then((r) => r.json())
      .then((data: GHData & { error?: string }) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setState({ status: "ready", data });
        // Webhook fallback: reconcile the stored status if GitHub disagrees.
        const ghStatus = data.state === "closed" ? "closed" : "open";
        if (ghStatus !== ticket.status) void syncTicketStatus(ticket.id, ghStatus);
      })
      .catch((e: Error) => {
        if (!cancelled) setState({ status: "error", message: e.message });
      });
    return () => { cancelled = true; };
  }, [linked, ticket.id, ticket.status]);

  return state;
}

export default function TicketDetailDialog({ ticket, project, open, onOpenChange }: TicketDetailDialogProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const handleCommentPosted = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <TicketDetailBody
          key={`${ticket.id}-${refreshKey}`}
          ticket={ticket}
          project={project}
          open={open}
          onCommentPosted={handleCommentPosted}
        />
      </DialogContent>
    </Dialog>
  );
}

function TicketDetailBody({
  ticket, project, open, onCommentPosted,
}: {
  ticket: Ticket;
  project?: Project;
  open: boolean;
  onCommentPosted: () => void;
}) {
  const activity = useGitHubActivity(ticket, open);
  const ghData = activity.status === "ready" ? activity.data : null;
  const loading = activity.status === "loading";
  const ghError = activity.status === "error" ? activity.message : null;

  const displayLabels = ghData?.labels?.length ? ghData.labels.map((l) => l.name) : (ticket.labels ?? []);
  const liveStatus =
    ghData?.state === "closed" ? "closed" : ghData?.state === "open" ? "open" : ticket.status;
  const liveLabel = liveStatus.charAt(0).toUpperCase() + liveStatus.slice(1).replace(/_/g, " ");

  return (
    <>
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {project && (
            <span className="text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              {project.project_name}
            </span>
          )}
          <Badge variant="outline" className={`text-xs border font-bold ${statusClasses(liveStatus)}`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 inline-block ${liveStatus === "open" ? "bg-success animate-ping" : "bg-muted-foreground"}`} />
            {liveLabel}
          </Badge>
        </div>
        <DialogTitle className="text-base font-bold leading-snug text-left pr-6">
          {ticket.title}
        </DialogTitle>
      </DialogHeader>

      <div className="mt-3">
        <SectionLabel>Description</SectionLabel>
        <div className="bg-muted/40 rounded-xl px-4 py-3.5 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {ticket.description}
        </div>
      </div>

      {displayLabels.length > 0 && (
        <div className="mt-4">
          <SectionLabel>Labels</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {displayLabels.map((l) => {
              const color = ghData?.labels?.find((gl) => gl.name === l)?.color;
              const safeColor = color && /^[0-9a-fA-F]{6}$/.test(color) ? color : undefined;
              return (
                <span
                  key={l}
                  className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border border-border bg-muted text-muted-foreground"
                  style={safeColor ? {
                    backgroundColor: `#${safeColor}22`,
                    borderColor:     `#${safeColor}55`,
                    color:           `#${safeColor}`,
                  } : undefined}
                >
                  {l}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Activity</SectionLabel>
          {loading && (
            <span className="text-[11px] text-muted-foreground animate-pulse">Syncing with your project..</span>
          )}
        </div>

        {ghError && (
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-xl px-4 py-3">
            Could not load activity — {ghError}
          </div>
        )}

        {ghData && ghData.comments.length === 0 && (
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-xl px-4 py-3 text-center">
            No comments yet on this issue.
          </div>
        )}

        {ghData && ghData.comments.length > 0 && (
          <div className="space-y-3">
            <TimelineItem avatar={null} author="You" time={null} isSystem body="Ticket submitted" />
            {ghData.comments.map((c) => (
              <TimelineItem key={c.id} avatar={c.avatar} author={c.author} time={c.created_at} body={c.body} />
            ))}
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-7 h-7 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 w-24 bg-muted rounded" />
                  <div className="h-3 w-full bg-muted rounded" />
                  <div className="h-3 w-3/4 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {ticket.github_issue_number ? (
        <CommentForm ticketId={ticket.id} onCommentPosted={onCommentPosted} />
      ) : (
        <div className="mt-5 pt-5 border-t border-border/60">
          <p className="text-xs text-muted-foreground text-center">
            Reply will be available once this ticket is synced with your project.
          </p>
        </div>
      )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
      {children}
    </p>
  );
}

function TimelineItem({
  avatar, author, time, body, isSystem,
}: {
  avatar: string | null;
  author: string;
  time: string | null;
  body: string;
  isSystem?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 mt-0.5">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={author} className="w-7 h-7 rounded-full border border-border/60" />
        ) : (
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold
            ${isSystem ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
            {isSystem ? "★" : author.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xs font-bold text-foreground">{isSystem ? "System" : author}</span>
          {time && <span className="text-[11px] text-muted-foreground">{timeAgo(time)}</span>}
        </div>
        <div className={`text-sm leading-relaxed rounded-xl px-3.5 py-2.5
          ${isSystem ? "bg-secondary/60 text-secondary-foreground text-xs font-semibold" : "bg-muted/50 text-foreground"}`}>
          {body}
        </div>
      </div>
    </div>
  );
}
