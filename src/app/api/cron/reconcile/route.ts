/**
 * POST /api/cron/reconcile — authenticated by `Authorization: Bearer <CRON_SECRET>`.
 *
 * Safety net for missed GitHub webhooks: compares every linked ticket's status
 * with its GitHub issue and patches mismatches in two batched updates. Invoked
 * every 5 minutes by `netlify/functions/reconcile.mts`. Also prunes the
 * rate-limit and webhook-delivery bookkeeping tables.
 */

import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasGitHubToken, listRepoIssues } from "@/lib/github";

export const maxDuration = 60;

const CONCURRENCY = 4;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Run `fn` over `items` with at most `limit` in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          results[i] = { status: "fulfilled", value: await fn(items[i]) };
        } catch (reason) {
          results[i] = { status: "rejected", reason };
        }
      }
    })
  );
  return results;
}

interface ProjectRow {
  id: string;
  github_repo: string;
  tickets: Array<{ id: string; github_issue_number: number | null; status: string }>;
}

export async function POST(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  if (!hasGitHubToken()) return Response.json({ error: "GITHUB_PAT not configured" }, { status: 500 });

  const db = createAdminClient();
  const startedAt = Date.now();

  const { data: projects, error } = await db
    .from("projects")
    .select("id, github_repo, tickets(id, github_issue_number, status)")
    .not("tickets.github_issue_number", "is", null)
    .overrideTypes<ProjectRow[], { merge: false }>();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const candidates = (projects ?? []).filter((p) => p.tickets.length > 0);

  const results = await mapLimit(candidates, CONCURRENCY, async (project) => {
    const issues = await listRepoIssues(project.github_repo);
    if (!issues) throw new Error(`${project.github_repo}: GitHub fetch failed`);
    const stateByNumber = new Map(issues.map((i) => [i.number, i.state === "closed" ? "closed" : "open"]));
    const diffs: Array<{ id: string; status: "open" | "closed" }> = [];
    for (const t of project.tickets) {
      const expected = stateByNumber.get(t.github_issue_number!);
      if (expected && expected !== t.status) diffs.push({ id: t.id, status: expected as "open" | "closed" });
    }
    return diffs;
  });

  const diffs = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const failures = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));

  for (const status of ["open", "closed"] as const) {
    const ids = diffs.filter((d) => d.status === status).map((d) => d.id);
    if (ids.length) {
      const { error: updErr } = await db.from("tickets").update({ status }).in("id", ids);
      if (updErr) failures.push(`update ${status}: ${updErr.message}`);
    }
  }

  // Housekeeping
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await Promise.all([
    db.from("rate_limits").delete().lt("window_start", dayAgo),
    db.from("webhook_deliveries").delete().lt("received_at", dayAgo),
  ]);

  return Response.json({
    projects: candidates.length,
    updated: diffs.length,
    failures,
    ms: Date.now() - startedAt,
  });
}
