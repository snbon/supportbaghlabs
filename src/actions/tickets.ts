"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * syncTicketStatus — called by the dialog when it detects a mismatch between
 * the GitHub issue state and the stored ticket status. Acts as a fallback in
 * case the webhook didn't fire or failed.
 */
export async function syncTicketStatus(ticketId: string, status: string): Promise<void> {
  const sessionSupabase = await createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();
  if (!user) return;

  const supabase = createAdminClient();

  // Verify the caller owns the ticket's project before updating
  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, project_id, status")
    .eq("id", ticketId)
    .single();

  if (!ticket) return;
  if (ticket.status === status) return; // already in sync

  const { data: project } = await supabase
    .from("projects")
    .select("client_id")
    .eq("id", ticket.project_id)
    .single();

  // Allow if the caller is the ticket's owner or a superadmin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();

  const isOwner = project?.client_id === user.id;
  const isAdmin = profile?.is_superadmin === true;

  if (!isOwner && !isAdmin) return;

  await supabase.from("tickets").update({ status }).eq("id", ticketId);
  revalidatePath("/");
}

/**
 * syncTicketStatuses — polls GitHub for the current state of all tickets in the
 * given projects and patches any status mismatches in Supabase.
 *
 * Called every 30 seconds from the client dashboard as a fallback when the
 * GitHub webhook fails to deliver an event (e.g. closed → reopened).
 */
export async function syncTicketStatuses(projectIds: string[]): Promise<void> {
  if (projectIds.length === 0) return;

  const pat = process.env.GITHUB_PAT;
  if (!pat) return;

  const supabase = createAdminClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, github_repo")
    .in("id", projectIds);

  if (!projects?.length) return;

  for (const project of projects) {
    // Fetch all issues (open + closed) from GitHub for this repo
    const ghRes = await fetch(
      `https://api.github.com/repos/${project.github_repo}/issues?state=all&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        cache: "no-store",
      }
    );

    if (!ghRes.ok) continue;

    const issues: Array<{ number: number; state: string; title: string; body: string | null; pull_request?: unknown }> =
      await ghRes.json();

    // Build a lookup: issue number → GitHub state
    const ghStateByNumber = new Map(
      issues.filter((i) => !i.pull_request).map((i) => [i.number, i.state])
    );

    // Fetch tickets for this project that have a github_issue_number
    const { data: tickets } = await supabase
      .from("tickets")
      .select("id, github_issue_number, status")
      .eq("project_id", project.id)
      .not("github_issue_number", "is", null);

    if (!tickets?.length) continue;

    // Patch any that are out of sync
    for (const ticket of tickets) {
      const ghState = ghStateByNumber.get(ticket.github_issue_number!);
      if (!ghState) continue;
      const expected = ghState === "closed" ? "closed" : "open";
      if (ticket.status !== expected) {
        await supabase.from("tickets").update({ status: expected }).eq("id", ticket.id);
      }
    }
  }
}

export interface TicketState {
  error?: string;
  success?: boolean;
}

export async function submitTicket(
  _prevState: TicketState,
  formData: FormData
): Promise<TicketState> {
  const projectId   = formData.get("projectId")   as string;
  const title       = formData.get("title")        as string;
  const description = formData.get("description")  as string;

  if (!projectId || !title || !description) {
    return { error: "All fields are required." };
  }

  // Verify the caller is authenticated (session client for auth only)
  const sessionSupabase = await createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // All DB operations via admin client — bypasses RLS auth.uid() resolution issues
  const supabase = createAdminClient();

  // Verify the project actually belongs to this user (application-layer security)
  const { data: project } = await supabase
    .from("projects")
    .select("id, client_id, github_repo")
    .eq("id", projectId)
    .single();

  if (!project) return { error: "Project not found." };
  if (project.client_id !== user.id) return { error: "Unauthorized." };

  // Insert the ticket
  const { data: ticket, error: insertError } = await supabase
    .from("tickets")
    .insert({ project_id: projectId, title, description, status: "open", labels: [] })
    .select("id")
    .single();

  if (insertError) {
    console.error("Ticket insert error:", insertError);
    return { error: "Failed to create ticket. Please try again." };
  }

  // Create GitHub issue
  if (project.github_repo) {
    const ghRes = await fetch(
      `https://api.github.com/repos/${project.github_repo}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_PAT}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, body: description }),
      }
    );

    if (ghRes.ok) {
      const ghIssue = await ghRes.json();
      await supabase
        .from("tickets")
        .update({ github_issue_number: ghIssue.number })
        .eq("id", ticket.id);
    } else {
      console.error("GitHub issue creation failed:", await ghRes.text());
    }
  }

  revalidatePath("/");
  return { success: true };
}
