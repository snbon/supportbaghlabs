/**
 * GET /api/github-comments?ticketId=<uuid>
 *
 * Authenticated proxy so GITHUB_PAT never reaches the browser. The repo and
 * issue number are resolved from the caller's own ticket — the client cannot
 * point this endpoint at arbitrary repositories.
 */

import { getSession, getTicketForUser } from "@/lib/dal";
import { rateLimit } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/validation";
import { githubHeaders, hasGitHubToken, issueUrl } from "@/lib/github";

interface GHComment {
  id: number;
  body: string;
  created_at: string;
  user?: { login: string; avatar_url: string };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await rateLimit(`comments-api:${session.userId}`, 60, 60))) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const ticketId = uuidSchema.safeParse(new URL(request.url).searchParams.get("ticketId"));
  if (!ticketId.success) return Response.json({ error: "Invalid ticketId" }, { status: 400 });

  const owned = await getTicketForUser(ticketId.data, session);
  if (!owned) return Response.json({ error: "Ticket not found" }, { status: 404 });

  const { ticket, project } = owned;
  if (!ticket.github_issue_number || !hasGitHubToken()) {
    return Response.json({ error: "Ticket is not linked to GitHub" }, { status: 404 });
  }

  const headers = githubHeaders();
  const [issueRes, commentsRes] = await Promise.all([
    fetch(issueUrl(project.github_repo, ticket.github_issue_number), { headers, cache: "no-store" }),
    fetch(issueUrl(project.github_repo, ticket.github_issue_number, "/comments"), { headers, cache: "no-store" }),
  ]);

  if (!issueRes.ok) {
    return Response.json({ error: `GitHub returned ${issueRes.status}` }, { status: 502 });
  }

  const [issueData, commentsData] = await Promise.all([
    issueRes.json(),
    commentsRes.ok ? (commentsRes.json() as Promise<GHComment[]>) : Promise.resolve([] as GHComment[]),
  ]);

  return Response.json({
    labels: (issueData.labels ?? []).map((l: { name: string; color: string }) => ({ name: l.name, color: l.color })),
    state: issueData.state,
    comments: commentsData.map((c) => ({
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      author: c.user?.login ?? "unknown",
      avatar: c.user?.avatar_url ?? null,
    })),
  });
}
