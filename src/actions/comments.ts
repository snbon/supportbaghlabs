"use server";

import { getSession, getTicketForUser } from "@/lib/dal";
import { rateLimit } from "@/lib/rate-limit";
import { commentSchema, parseForm } from "@/lib/validation";
import { githubHeaders, hasGitHubToken, issueUrl } from "@/lib/github";

export interface CommentState {
  error?: string;
  success?: boolean;
}

/**
 * postComment — posts a comment to the GitHub issue linked to a ticket.
 * The repo and issue number are resolved from the database, never from the client.
 */
export async function postComment(
  _prev: CommentState,
  formData: FormData
): Promise<CommentState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  const parsed = parseForm(commentSchema, formData);
  if (!parsed.success) return { error: parsed.error };
  const { ticketId, body } = parsed.data;

  if (!(await rateLimit(`comment:${session.userId}`, 30, 60 * 60))) {
    return { error: "You are sending comments too quickly. Please wait a moment." };
  }

  const owned = await getTicketForUser(ticketId, session);
  if (!owned) return { error: "Ticket not found." };

  const { ticket, project } = owned;
  if (!ticket.github_issue_number || !project.github_repo || !hasGitHubToken()) {
    return { error: "This ticket is not linked to a GitHub issue yet." };
  }

  const ghRes = await fetch(issueUrl(project.github_repo, ticket.github_issue_number, "/comments"), {
    method: "POST",
    headers: githubHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ body }),
  });
  if (!ghRes.ok) {
    console.error("[postComment] GitHub returned", ghRes.status);
    return { error: "Failed to post comment. Please try again." };
  }
  return { success: true };
}
