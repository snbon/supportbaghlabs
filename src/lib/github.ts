/**
 * Thin GitHub REST helper. Repo names must already be validated with
 * `githubRepoSchema`; issue numbers are coerced to integers so they can never
 * inject path segments.
 */

import "server-only";

const API = "https://api.github.com";

export function githubHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.GITHUB_PAT}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...extra,
  };
}

export function hasGitHubToken(): boolean {
  return Boolean(process.env.GITHUB_PAT);
}

export function issueUrl(repo: string, issueNumber: number, suffix = ""): string {
  const n = Math.trunc(Number(issueNumber));
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid issue number");
  return `${API}/repos/${repo}/issues/${n}${suffix}`;
}

export function repoUrl(repo: string, suffix = ""): string {
  return `${API}/repos/${repo}${suffix}`;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  labels: Array<{ name: string; color?: string }>;
  pull_request?: unknown;
}

/** Fetch up to 100 issues (open + closed), excluding pull requests. */
export async function listRepoIssues(repo: string): Promise<GitHubIssue[] | null> {
  const res = await fetch(repoUrl(repo, "/issues?state=all&per_page=100"), {
    headers: githubHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const issues: GitHubIssue[] = await res.json();
  return issues.filter((i) => !i.pull_request);
}
