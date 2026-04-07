"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CommentState {
  error?: string;
  success?: boolean;
}

/**
 * postComment — posts a text comment to the GitHub issue linked to a ticket.
 */
export async function postComment(
  _prevState: CommentState,
  formData: FormData
): Promise<CommentState> {
  const sessionSupabase = await createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const ticketId   = formData.get("ticketId")   as string;
  const githubRepo = formData.get("githubRepo")  as string;
  const issueNum   = formData.get("issueNumber") as string;
  const body       = (formData.get("body") as string)?.trim();

  if (!body) return { error: "Please write a comment before sending." };
  if (!githubRepo || !issueNum) {
    return { error: "This ticket is not linked to a GitHub issue yet." };
  }

  // Verify the user owns the ticket
  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("tickets")
    .select("id, project_id")
    .eq("id", ticketId)
    .single();

  if (!ticket) return { error: "Ticket not found." };

  const { data: project } = await admin
    .from("projects")
    .select("client_id")
    .eq("id", ticket.project_id)
    .single();

  if (project?.client_id !== user.id) return { error: "Unauthorized." };

  const ghRes = await fetch(
    `https://api.github.com/repos/${githubRepo}/issues/${issueNum}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_PAT}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    }
  );

  if (!ghRes.ok) {
    const msg = await ghRes.text();
    console.error("GitHub comment post failed:", msg);
    return { error: "Failed to post comment. Please try again." };
  }

  return { success: true };
}
