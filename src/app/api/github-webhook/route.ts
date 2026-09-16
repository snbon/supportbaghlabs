/**
 * GitHub Webhook Handler — POST /api/github-webhook
 *
 * Syncs issue events (opened/closed/reopened/labeled/unlabeled/edited) back to
 * the matching ticket.
 *
 * Security:
 *  - HMAC-SHA256 signature is REQUIRED (fails closed if the secret is missing)
 *  - constant-time comparison with a length guard
 *  - replay protection via the X-GitHub-Delivery id (24 h retention)
 */

import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function verifySignature(request: Request, body: string): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook] GITHUB_WEBHOOK_SECRET not set — rejecting request.");
    return false;
  }
  const signature = request.headers.get("x-hub-signature-256");
  if (!signature) return false;

  const expected = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const ACTION_TO_STATUS: Record<string, "open" | "closed" | null> = {
  opened: "open",
  closed: "closed",
  reopened: "open",
  labeled: null,
  unlabeled: null,
  edited: null,
};

export async function POST(request: Request) {
  const body = await request.text();

  if (!verifySignature(request, body)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (request.headers.get("x-github-event") !== "issues") {
    return Response.json({ ok: true, message: "Event ignored" });
  }

  let payload: GitHubIssuePayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, issue, repository } = payload;
  if (!issue || !repository?.full_name || typeof issue.number !== "number") {
    return Response.json({ error: "Malformed payload" }, { status: 400 });
  }
  if (!(action in ACTION_TO_STATUS)) {
    return Response.json({ ok: true, message: "Action ignored" });
  }

  const db = createAdminClient();

  // Replay protection: each delivery id is processed once.
  const deliveryId = request.headers.get("x-github-delivery");
  if (deliveryId) {
    const { error } = await db.from("webhook_deliveries").insert({ delivery_id: deliveryId });
    if (error?.code === "23505") {
      return Response.json({ ok: true, message: "Duplicate delivery ignored" });
    }
    if (error) console.error("[webhook] delivery bookkeeping failed:", error.message);
  }

  const { data: project } = await db
    .from("projects")
    .select("id")
    .eq("github_repo", repository.full_name)
    .maybeSingle<{ id: string }>();
  if (!project) {
    return Response.json({ error: "No project found for this repo" }, { status: 404 });
  }

  const { data: ticket } = await db
    .from("tickets")
    .select("id")
    .eq("project_id", project.id)
    .eq("github_issue_number", issue.number)
    .maybeSingle<{ id: string }>();
  if (!ticket) {
    return Response.json({ error: "No ticket found for this issue" }, { status: 404 });
  }

  const updates: { status?: string; labels?: string[]; title?: string; description?: string } = {};
  const newStatus = ACTION_TO_STATUS[action];
  if (newStatus) updates.status = newStatus;
  if (action === "labeled" || action === "unlabeled") {
    updates.labels = (issue.labels ?? []).map((l) => l.name).filter((n) => typeof n === "string");
  }
  if (action === "edited") {
    if (typeof issue.title === "string") updates.title = issue.title.slice(0, 200);
    if (typeof issue.body === "string") updates.description = issue.body.slice(0, 10_000);
  }

  const { error: updateError } = await db.from("tickets").update(updates).eq("id", ticket.id);
  if (updateError) {
    console.error("[webhook] ticket update failed:", updateError.message);
    return Response.json({ error: "Failed to update ticket" }, { status: 500 });
  }

  console.log(`[webhook] ${action} → ticket ${ticket.id} (${Object.keys(updates).join(",")})`);
  return Response.json({ ok: true });
}

interface GitHubIssuePayload {
  action: string;
  issue: {
    number: number;
    title: string;
    body: string | null;
    state: string;
    labels: Array<{ name: string }>;
  };
  repository: { full_name: string };
}
