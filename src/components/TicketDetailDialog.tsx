"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import CommentForm from "@/components/CommentForm";
import type { Ticket, Project } from "@/lib/types";

interface GHComment {
  id: number;
  body: string;
  created_at: string;
  author: string;
  avatar: string | null;
}

interface GHData {
  labels:   { name: string; color: string }[];
  state:    string;
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
    case "open":        return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "closed":      return "bg-slate-100 text-slate-500 border-slate-200";
    case "in_progress": return "bg-blue-50 text-blue-700 border-blue-100";
    default:            return "bg-amber-50 text-amber-700 border-amber-100";
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

export default function TicketDetailDialog({ ticket, project, open, onOpenChange }: TicketDetailDialogProps) {
  const [ghData, setGhData]   = useState<GHData | null>(null);
  const [loading, setLoading] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);
  // Increment to force a re-fetch after a comment is posted
  const [refreshKey, setRefreshKey] = useState(0);
  const handleCommentPosted = useCallback(() => setRefreshKey((k) => k + 1), []);

  const statusLabel = ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1).replace(/_/g, " ");

  // Fetch GitHub data whenever the dialog opens (and we have an issue number)
  useEffect(() => {
    if (!open || !ticket.github_issue_number || !project?.github_repo) {
      setGhData(null);
      return;
    }

    setLoading(true);
    setGhError(null);

    fetch(`/api/github-comments?repo=${encodeURIComponent(project.github_repo)}&issue=${ticket.github_issue_number}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setGhData(data);
      })
      .catch((e) => setGhError(e.message))
      .finally(() => setLoading(false));
  // refreshKey increments after each comment post to force a re-fetch
  }, [open, ticket.github_issue_number, project?.github_repo, refreshKey]);

  // Live labels: merge GitHub labels into ticket labels if available
  const displayLabels = ghData?.labels?.length
    ? ghData.labels.map((l) => l.name)
    : (ticket.labels ?? []);

  // Live status from GitHub if available
  const liveStatus = ghData?.state === "closed" ? "closed"
    : ghData?.state === "open"   ? "open"
    : ticket.status;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          {/* Project chip + status */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {project && (
              <span className="text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                {project.project_name}
              </span>
            )}
            <Badge variant="outline" className={`text-xs border font-bold ${statusClasses(liveStatus)}`}>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 inline-block ${liveStatus === "open" ? "bg-emerald-500 animate-ping" : "bg-slate-400"}`} />
              {liveStatus === "open" ? "Open" : liveStatus.charAt(0).toUpperCase() + liveStatus.slice(1)}
            </Badge>
            {/** 
            {ticket.github_issue_number && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <GitHubIcon /> #{ticket.github_issue_number}
              </span>
            )} **/}
          </div>

          <DialogTitle className="text-base font-bold leading-snug text-left pr-6">
            {ticket.title}
          </DialogTitle>
        </DialogHeader>

        {/* Description */}
        <div className="mt-3">
          <SectionLabel>Description</SectionLabel>
          <div className="bg-muted/40 rounded-xl px-4 py-3.5 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {ticket.description}
          </div>
        </div>

        {/* Labels (live from GitHub) */}
        {displayLabels.length > 0 && (
          <div className="mt-4">
            <SectionLabel>Labels</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {displayLabels.map((l) => {
                const color = ghData?.labels?.find((gl) => gl.name === l)?.color;
                return (
                  <span
                    key={l}
                    className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border"
                    style={color ? {
                      backgroundColor: `#${color}22`,
                      borderColor:     `#${color}44`,
                      color:           `#${color}`,
                    } : undefined}
                  >
                    {l}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* GitHub timeline */}
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

          {!loading && !ghError && ghData?.comments?.length === 0 && (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-xl px-4 py-3 text-center">
              No comments yet on this issue.
            </div>
          )}

          {ghData?.comments && ghData.comments.length > 0 && (
            <div className="space-y-3">
              {/* Original submission event */}
              <TimelineItem
                avatar={null}
                author="You"
                time={null}
                isSystem
                body="Ticket submitted"
              />
              {ghData.comments.map((c) => (
                <TimelineItem
                  key={c.id}
                  avatar={c.avatar}
                  author={c.author}
                  time={c.created_at}
                  body={c.body}
                />
              ))}
            </div>
          )}

          {/* Skeleton while loading */}
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

        {/* Comment reply form */}
        {ticket.github_issue_number && project?.github_repo ? (
          <CommentForm
            ticketId={ticket.id}
            githubRepo={project.github_repo}
            issueNumber={ticket.github_issue_number}
            onCommentPosted={handleCommentPosted}
          />
        ) : (
          <div className="mt-5 pt-5 border-t border-border/60">
            <p className="text-xs text-muted-foreground text-center">
              Reply will be available once this ticket is synced with your project.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

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
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={author} className="w-7 h-7 rounded-full border border-border/60" />
        ) : (
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold
            ${isSystem ? "bg-[#D9EAFD] text-[#141f59]" : "bg-muted text-muted-foreground"}`}>
            {isSystem ? "★" : author.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Bubble */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xs font-bold text-foreground">{isSystem ? "System" : author}</span>
          {time && <span className="text-[11px] text-muted-foreground">{timeAgo(time)}</span>}
        </div>
        <div className={`text-sm leading-relaxed rounded-xl px-3.5 py-2.5
          ${isSystem ? "bg-[#D9EAFD]/60 text-[#141f59] text-xs font-semibold" : "bg-muted/50 text-foreground"}`}>
          {body}
        </div>
      </div>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
}

