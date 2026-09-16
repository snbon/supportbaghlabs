"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession, getTicketForUser } from "@/lib/dal";
import { parseForm, submitTicketSchema, ticketStatusSchema, uuidSchema } from "@/lib/validation";
import { githubHeaders, hasGitHubToken, repoUrl } from "@/lib/github";

export interface TicketState {
  error?: string;
  success?: boolean;
}

/**
 * syncTicketStatus — called by the ticket dialog when the GitHub issue state
 * differs from the stored status (webhook fallback). Realtime propagates the
 * change to open dashboards; no full page revalidation needed.
 */
export async function syncTicketStatus(ticketId: string, status: string): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const id = uuidSchema.safeParse(ticketId);
  const nextStatus = ticketStatusSchema.safeParse(status);
  if (!id.success || !nextStatus.success) return;

  const owned = await getTicketForUser(id.data, session);
  if (!owned || owned.ticket.status === nextStatus.data) return;

  await createAdminClient()
    .from("tickets")
    .update({ status: nextStatus.data })
    .eq("id", owned.ticket.id);
}

/** submitTicket — creates a ticket and mirrors it as a GitHub issue. */
export async function submitTicket(
  _prev: TicketState,
  formData: FormData
): Promise<TicketState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  const parsed = parseForm(submitTicketSchema, formData);
  if (!parsed.success) return { error: parsed.error };
  const { projectId, title, description } = parsed.data;

  const admin = createAdminClient();

  const { data: project } = await admin
    .from("projects")
    .select("id, client_id, github_repo")
    .eq("id", projectId)
    .maybeSingle<{ id: string; client_id: string; github_repo: string }>();
  if (!project || project.client_id !== session.userId) return { error: "Project not found." };

  const { data: ticket, error: insertError } = await admin
    .from("tickets")
    .insert({ project_id: projectId, title, description, status: "open", labels: [] })
    .select("id")
    .single<{ id: string }>();
  if (insertError || !ticket) {
    console.error("[submitTicket] insert:", insertError?.message);
    return { error: "Failed to create ticket. Please try again." };
  }

  if (project.github_repo && hasGitHubToken()) {
    try {
      const ghRes = await fetch(repoUrl(project.github_repo, "/issues"), {
        method: "POST",
        headers: githubHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ title, body: description }),
      });
      if (ghRes.ok) {
        const ghIssue: { number: number } = await ghRes.json();
        await admin.from("tickets").update({ github_issue_number: ghIssue.number }).eq("id", ticket.id);
      } else {
        console.error("[submitTicket] GitHub issue creation failed:", ghRes.status);
      }
    } catch (e) {
      console.error("[submitTicket] GitHub exception:", e);
    }
  }

  revalidatePath("/");
  return { success: true };
}
