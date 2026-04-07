/**
 * GET /api/github-comments?repo=owner/repo&issue=123
 *
 * Server-side proxy so GITHUB_PAT never reaches the browser.
 * Returns the issue details + all comments from GitHub.
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repo  = searchParams.get("repo");
  const issue = searchParams.get("issue");

  if (!repo || !issue) {
    return Response.json({ error: "Missing repo or issue param" }, { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${process.env.GITHUB_PAT}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // Fetch issue details and comments in parallel
  const [issueRes, commentsRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${repo}/issues/${issue}`, { headers }),
    fetch(`https://api.github.com/repos/${repo}/issues/${issue}/comments`, { headers }),
  ]);

  if (!issueRes.ok) {
    return Response.json({ error: `GitHub returned ${issueRes.status}` }, { status: 502 });
  }

  const [issueData, commentsData] = await Promise.all([
    issueRes.json(),
    commentsRes.ok ? commentsRes.json() : Promise.resolve([]),
  ]);

  return Response.json({
    labels:   (issueData.labels ?? []).map((l: { name: string; color: string }) => ({ name: l.name, color: l.color })),
    state:    issueData.state,        // "open" | "closed"
    comments: commentsData.map((c: GHComment) => ({
      id:         c.id,
      body:       c.body,
      created_at: c.created_at,
      author:     c.user?.login ?? "unknown",
      avatar:     c.user?.avatar_url ?? null,
    })),
  });
}

interface GHComment {
  id: number;
  body: string;
  created_at: string;
  user?: { login: string; avatar_url: string };
}
