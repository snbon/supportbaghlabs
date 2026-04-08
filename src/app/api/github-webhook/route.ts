/**
 * GitHub Webhook Handler — POST /api/github-webhook
 *
 * Receives GitHub issue events and syncs ticket state back to Supabase.
 *
 * Events handled:
 *   - opened   → status: "open"
 *   - closed   → status: "closed"
 *   - reopened → status: "open"
 *   - labeled  → update labels array
 *   - unlabeled → update labels array
 *   - edited   → sync title and description from GitHub
 *
 * Security: Validates the HMAC-SHA256 signature from GitHub using
 * GITHUB_WEBHOOK_SECRET to ensure requests are genuine.
 *
 * Matching: Tickets are matched by github_issue_number + project's github_repo.
 * This is more robust than matching by title.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

/** Verify the GitHub webhook signature. */
async function verifySignature(
  request: Request,
  body: string
): Promise<boolean> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  // If no secret is configured, skip verification (not recommended for production)
  if (!secret) {
    console.warn("GITHUB_WEBHOOK_SECRET not set — skipping signature verification.");
    return true;
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (!signature) return false;

  // Compute HMAC-SHA256 of the raw body using the secret
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  const expectedSignature = `sha256=${hmac.digest("hex")}`;

  // Timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: Request) {
  // Read the raw body first (needed for signature verification)
  const body = await request.text();

  // Verify the webhook signature
  const isValid = await verifySignature(request, body);
  if (!isValid) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Only handle "issues" events
  const eventType = request.headers.get("x-github-event");
  if (eventType !== "issues") {
    return Response.json({ ok: true, message: "Event ignored" });
  }

  let payload: GitHubIssuePayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, issue, repository } = payload;
  const githubRepo = repository.full_name; // e.g. "owner/repo-name"
  const issueNumber = issue.number;

  // Map GitHub issue actions to ticket status values
  const actionToStatus: Record<string, string | null> = {
    opened: "open",
    closed: "closed",
    reopened: "open",
    labeled: null,   // labels-only update
    unlabeled: null, // labels-only update
    edited: null,    // title/description sync
  };

  // Ignore unrecognized actions
  if (!(action in actionToStatus)) {
    return Response.json({ ok: true, message: "Action ignored" });
  }

  const adminSupabase = createAdminClient();

  // Find the project matching this repo
  const { data: project } = await adminSupabase
    .from("projects")
    .select("id")
    .eq("github_repo", githubRepo)
    .single();

  if (!project) {
    return Response.json(
      { error: "No project found for this repo" },
      { status: 404 }
    );
  }

  // Find the ticket by issue number + project
  const { data: ticket } = await adminSupabase
    .from("tickets")
    .select("id")
    .eq("project_id", project.id)
    .eq("github_issue_number", issueNumber)
    .single();

  if (!ticket) {
    return Response.json(
      { error: "No ticket found for this issue" },
      { status: 404 }
    );
  }

  // Build the update object based on the action
  const updates: { status?: string; labels?: string[]; title?: string; description?: string } = {};

  const newStatus = actionToStatus[action];
  if (newStatus !== null) {
    updates.status = newStatus;
  }

  // For label events, always sync the full labels array from the issue
  if (action === "labeled" || action === "unlabeled") {
    updates.labels = issue.labels.map((l) => l.name);
  }

  // For edited events, sync title and description from GitHub
  if (action === "edited") {
    updates.title = issue.title;
    if (issue.body != null) {
      updates.description = issue.body;
    }
  }

  // Apply the update
  const { error: updateError } = await adminSupabase
    .from("tickets")
    .update(updates)
    .eq("id", ticket.id);

  if (updateError) {
    console.error("Ticket update error:", updateError);
    return Response.json({ error: "Failed to update ticket" }, { status: 500 });
  }

  return Response.json({ ok: true });
}

// ─── GitHub Webhook Payload Types ──────────────────────────────────────────────

interface GitHubLabel {
  id: number;
  name: string;
  color: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: GitHubLabel[];
}

interface GitHubRepository {
  full_name: string; // "owner/repo"
}

interface GitHubIssuePayload {
  action: string;
  issue: GitHubIssue;
  repository: GitHubRepository;
}
