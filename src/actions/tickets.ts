"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
