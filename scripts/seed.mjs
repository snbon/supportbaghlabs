#!/usr/bin/env node
/**
 * Seed test accounts for manual QA — safe to re-run (removes and recreates
 * the seed users each time). Never touches other accounts.
 *
 *   npm run db:seed
 *
 * Creates:
 *   - a superadmin      seed-admin@example.com
 *   - a client company  seed-client@example.com  ("Seed Company BV")
 *     with one project linked to SEED_REPO and ~12 tickets mirrored as real
 *     GitHub issues (mix of open/closed/labelled) so every UI path has data.
 *
 * Reads .env / .env.local for SUPABASE + GITHUB credentials.
 */

import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const SEED_REPO = process.env.SEED_REPO ?? "snbon/seedforsupportbagh";
const ADMIN_EMAIL = "seed-admin@example.com";
const CLIENT_EMAIL = "seed-client@example.com";
const COMPANY = "Seed Company BV";
const PROJECT = "Seed Project";

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GITHUB_PAT"];
for (const k of required) if (!process.env[k]) { console.error(`Missing ${k}`); process.exit(1); }

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const gh = (path, init = {}) =>
  fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_PAT}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

const password = () => "Seed-" + randomBytes(9).toString("base64url");

const WORKSPACE = "seed";

async function resetUser(email, { company, superadmin, pwd }) {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data.users.filter((u) => u.email === email)) {
    await db.auth.admin.deleteUser(u.id); // cascades profiles → projects → tickets
  }
  const { data: created, error } = await db.auth.admin.createUser({ email, password: pwd, email_confirm: true });
  if (error) throw error;
  const { error: pErr } = await db.from("profiles")
    .insert({ id: created.user.id, company_name: company, is_superadmin: superadmin, email, workspace: WORKSPACE });
  if (pErr) throw pErr;
  return created.user.id;
}

const ISSUES = [
  { title: "Login page shows blank screen on Safari", body: "After entering credentials on Safari 17 the page stays white. Works in Chrome.", labels: ["bug"], close: false },
  { title: "Invoice PDF export cuts off the last line", body: "Steps: open invoice > Export PDF. The totals row is missing.", labels: ["bug"], close: false },
  { title: "Add dark mode to the customer portal", body: "Several users asked for a dark theme.", labels: ["enhancement"], close: false },
  { title: "Password reset email lands in spam", body: "Gmail marks the reset mail as spam. SPF/DKIM?", labels: ["bug", "email"], close: true },
  { title: "Dashboard loads slowly with 500+ orders", body: "~6s on the orders overview. Please profile the query.", labels: ["performance"], close: false },
  { title: "Typo in the onboarding welcome text", body: "'recieve' should be 'receive'.", labels: [], close: true },
  { title: "Allow CSV import of products", body: "We maintain products in Excel; a CSV import would save hours.", labels: ["enhancement"], close: false },
  { title: "Mobile menu does not close after navigation", body: "On iOS the hamburger menu stays open after tapping a link.", labels: ["bug", "mobile"], close: false },
  { title: "Wrong VAT rate for Belgian customers", body: "Shows 19% instead of 21%.", labels: ["bug"], close: true },
  { title: "Export button disabled for viewer role", body: "Viewers should be able to export their own reports.", labels: ["question"], close: false },
  { title: "Two-factor authentication support", body: "Would like TOTP-based 2FA for admin accounts.", labels: ["enhancement", "security"], close: false },
  { title: "Broken image on the contact page", body: "The team photo returns 404.", labels: [], close: true },
];

async function ensureGitHubIssues() {
  const repoRes = await gh(`/repos/${SEED_REPO}`);
  if (!repoRes.ok) throw new Error(`GitHub repo ${SEED_REPO} not reachable (${repoRes.status}) — check GITHUB_PAT scope`);

  const listRes = await gh(`/repos/${SEED_REPO}/issues?state=all&per_page=100`);
  const existing = (await listRes.json()).filter((i) => !i.pull_request);
  const byTitle = new Map(existing.map((i) => [i.title, i]));

  const issues = [];
  for (const spec of ISSUES) {
    let issue = byTitle.get(spec.title);
    if (!issue) {
      const res = await gh(`/repos/${SEED_REPO}/issues`, {
        method: "POST",
        body: JSON.stringify({ title: spec.title, body: spec.body, labels: spec.labels }),
      });
      if (res.status === 403 || res.status === 404) {
        console.warn(`  ⚠ GITHUB_PAT cannot write to ${SEED_REPO} (${res.status}). Falling back to database-only tickets.`);
        console.warn("    Grant the token access to that repository (Issues: read/write) and re-run to mirror real issues.");
        return null;
      }
      if (!res.ok) throw new Error(`create issue failed: ${res.status} ${await res.text()}`);
      issue = await res.json();
      if (spec.close) {
        await gh(`/repos/${SEED_REPO}/issues/${issue.number}/comments`, {
          method: "POST", body: JSON.stringify({ body: "Fixed and deployed — closing. Thanks for reporting!" }),
        });
        const c = await gh(`/repos/${SEED_REPO}/issues/${issue.number}`, { method: "PATCH", body: JSON.stringify({ state: "closed" }) });
        issue = await c.json();
      } else if (spec.labels.includes("bug")) {
        await gh(`/repos/${SEED_REPO}/issues/${issue.number}/comments`, {
          method: "POST", body: JSON.stringify({ body: "Thanks — we can reproduce this and are looking into it." }),
        });
      }
      console.log(`  created issue #${issue.number}: ${spec.title}`);
    }
    issues.push(issue);
  }
  return issues;
}

async function registerWebhook() {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!secret || !site) { console.log("  (skipping webhook: GITHUB_WEBHOOK_SECRET or NEXT_PUBLIC_SITE_URL missing)"); return; }
  const res = await gh(`/repos/${SEED_REPO}/hooks`, {
    method: "POST",
    body: JSON.stringify({
      name: "web", active: true, events: ["issues"],
      config: { url: `${site}/api/github-webhook`, content_type: "json", insecure_ssl: "0", secret },
    }),
  });
  console.log(res.status === 422 ? "  webhook already registered" : res.ok ? "  webhook registered" : `  webhook failed: ${res.status}`);
}

(async () => {
  const adminPwd = password();
  const clientPwd = password();

  console.log("Seeding admin…");
  await resetUser(ADMIN_EMAIL, { company: "Seed Admin", superadmin: true, pwd: adminPwd });

  console.log("Seeding client…");
  const clientId = await resetUser(CLIENT_EMAIL, { company: COMPANY, superadmin: false, pwd: clientPwd });

  const { data: project, error: prErr } = await db.from("projects")
    .insert({ client_id: clientId, project_name: PROJECT, github_repo: SEED_REPO }).select("id").single();
  if (prErr) throw prErr;

  console.log(`Ensuring GitHub issues in ${SEED_REPO}…`);
  const issues = await ensureGitHubIssues();

  const rows = issues
    ? issues.map((i) => ({
        project_id: project.id,
        title: i.title,
        description: i.body ?? "",
        status: i.state === "closed" ? "closed" : "open",
        labels: (i.labels ?? []).map((l) => l.name),
        github_issue_number: i.number,
      }))
    : ISSUES.map((i) => ({
        project_id: project.id,
        title: i.title,
        description: i.body,
        status: i.close ? "closed" : "open",
        labels: i.labels,
        github_issue_number: null,
      }));
  const { error: tErr } = await db.from("tickets").insert(rows);
  if (tErr) throw tErr;
  console.log(`  ${rows.length} tickets linked`);

  if (issues) await registerWebhook();

  console.log("\n══════════════ SEED ACCOUNTS ══════════════");
  console.log(`Superadmin  ${ADMIN_EMAIL}   ${adminPwd}`);
  console.log(`Client      ${CLIENT_EMAIL}  ${clientPwd}   (${COMPANY} → ${PROJECT})`);
  console.log("Re-run `npm run db:seed` to reset them with fresh passwords.");
})().catch((e) => { console.error("Seed failed:", e.message ?? e); process.exit(1); });
