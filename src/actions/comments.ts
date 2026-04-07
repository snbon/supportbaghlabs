"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CommentState {
  error?: string;
  success?: boolean;
}

/**
 * postComment — posts a comment (with optional file attachments) to the
 * GitHub issue linked to a ticket.
 *
 * Flow:
 * 1. Verify the caller is authenticated and owns the project
 * 2. Upload any attached files to Supabase Storage
 * 3. Build the GitHub comment body (markdown, with embedded images / PDF links)
 * 4. POST the comment to the GitHub Issues API
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
  const files      = formData.getAll("files") as File[];

  if (!body && files.filter((f) => f.size > 0).length === 0) {
    return { error: "Please write a comment or attach a file." };
  }
  if (!githubRepo || !issueNum) {
    return { error: "This ticket is not linked to a GitHub issue yet." };
  }

  // Verify the user owns the ticket (security check)
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

  // Upload files and collect markdown snippets
  const validFiles = files.filter((f) => f.size > 0);
  const attachmentLines: string[] = [];

  for (const file of validFiles) {
    const ext      = file.name.split(".").pop()?.toLowerCase() ?? "";
    const safeName = `${ticketId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const arrayBuf = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await admin
      .storage
      .from("ticket-attachments")
      .upload(safeName, arrayBuf, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("File upload error:", uploadError);
      continue; // skip failed file, don't abort the whole comment
    }

    const { data: { publicUrl } } = admin
      .storage
      .from("ticket-attachments")
      .getPublicUrl(uploadData.path);

    if (["jpg", "jpeg", "png"].includes(ext)) {
      // Embed images inline in the comment
      attachmentLines.push(`![${file.name}](${publicUrl})`);
    } else {
      // PDFs as a link
      attachmentLines.push(`📎 [${file.name}](${publicUrl})`);
    }
  }

  // Build the final GitHub comment body
  const parts: string[] = [];
  if (body) parts.push(body);
  if (attachmentLines.length > 0) {
    if (body) parts.push("\n---");
    parts.push(...attachmentLines);
  }
  const commentBody = parts.join("\n");

  // Post to GitHub
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
      body: JSON.stringify({ body: commentBody }),
    }
  );

  if (!ghRes.ok) {
    const msg = await ghRes.text();
    console.error("GitHub comment post failed:", msg);
    return { error: "Failed to post comment. Please try again." };
  }

  return { success: true };
}
