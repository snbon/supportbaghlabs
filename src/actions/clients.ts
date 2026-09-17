/**
 * Client management — SUPERADMIN ONLY (enforced server-side on every action).
 */

"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile, getSession, getSuperadminSession, isWorkspaceAdminOf } from "@/lib/dal";
import { rateLimit } from "@/lib/rate-limit";
import {
  addProjectSchema,
  escapeHtml,
  inviteClientSchema,
  parseForm,
  resendInvitationSchema,
} from "@/lib/validation";
import { githubHeaders, hasGitHubToken, listRepoIssues, repoUrl } from "@/lib/github";

export interface ClientActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

const portalUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://support.baghlabs.com";
const FROM = "Baghlabs Support <support@baghlabs.com>";

/**
 * inviteClient — creates a client user, their profile and first project, then
 * emails a one-time setup link.
 */
export async function inviteClient(
  _prev: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  const session = await getSuperadminSession();
  if (!session) return { error: "Unauthorized." };
  const me = await getProfile(session.userId);
  if (!me) return { error: "Unauthorized." };

  const parsed = parseForm(inviteClientSchema, formData);
  if (!parsed.success) return { error: parsed.error };
  const { email, companyName, projectName, githubRepo } = parsed.data;

  const admin = createAdminClient();

  // 1. Auth user with a throwaway password; the user sets their own via the link.
  const tempPassword = crypto.randomUUID() + crypto.randomUUID();
  const { data: userData, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: false,
  });
  if (createUserError || !userData.user) {
    console.error("[inviteClient] createUser:", createUserError?.message);
    return { error: createUserError?.message || "Failed to create user." };
  }
  const userId = userData.user.id;

  // 2. Profile row (email is denormalised here; the auth trigger keeps it fresh)
  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: userId, company_name: companyName, is_superadmin: false, email, workspace: me.workspace });
  if (profileError) {
    console.error("[inviteClient] profile insert:", profileError.message);
    await admin.auth.admin.deleteUser(userId);
    return { error: "Failed to create profile. User has been rolled back." };
  }

  // 3. First project
  const { data: projectData, error: projectError } = await admin
    .from("projects")
    .insert({ client_id: userId, project_name: projectName, github_repo: githubRepo })
    .select("id")
    .single();
  if (projectError || !projectData) {
    console.error("[inviteClient] project insert:", projectError?.message);
    return { error: "User created but project setup failed. Please add the project manually." };
  }

  // Best-effort GitHub sync, in parallel
  await Promise.all([
    importGitHubIssues(admin, projectData.id, githubRepo),
    registerGitHubWebhook(githubRepo),
  ]);

  // 4. Setup link + email
  const setupLink = await generateSetupLink(admin, email);
  revalidatePath("/");
  if (!setupLink) {
    return {
      success: true,
      message: "Client created but setup link generation failed. Use 'Resend invite' from their row.",
    };
  }

  const sent = await sendEmail({
    to: email,
    subject: `Welcome to the Baghlabs Support Portal — ${companyName}`,
    html: buildInvitationEmail({ companyName, email, setupLink, projectName }),
  });
  if (!sent) {
    return {
      success: true,
      message: "Client created but the email failed to send. Use 'Resend invite' from their row.",
    };
  }
  return { success: true, message: `${companyName} has been invited. Setup email sent to ${email}.` };
}

/** addProject — adds a project to an existing client. */
export async function addProject(
  _prev: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  const session = await getSuperadminSession();
  if (!session) return { error: "Unauthorized." };

  const parsed = parseForm(addProjectSchema, formData);
  if (!parsed.success) return { error: parsed.error };
  const { clientId, projectName, githubRepo } = parsed.data;

  const admin = createAdminClient();

  const { data: client } = await admin
    .from("profiles").select("id").eq("id", clientId).eq("is_superadmin", false).maybeSingle();
  if (!client || !(await isWorkspaceAdminOf(session.userId, clientId))) return { error: "Client not found." };

  const { data: projectData, error } = await admin
    .from("projects")
    .insert({ client_id: clientId, project_name: projectName, github_repo: githubRepo })
    .select("id")
    .single();
  if (error || !projectData) {
    console.error("[addProject] insert:", error?.message);
    return { error: "Failed to add project. Please try again." };
  }

  await Promise.all([
    importGitHubIssues(admin, projectData.id, githubRepo),
    registerGitHubWebhook(githubRepo),
  ]);

  revalidatePath("/");
  return { success: true, message: `Project "${projectName}" added successfully.` };
}

/**
 * resendInvitation — re-sends the setup email.
 * Allowed for superadmins (any client) and for a signed-in user (their own address).
 */
export async function resendInvitation(
  _prev: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  const parsed = parseForm(resendInvitationSchema, formData);
  if (!parsed.success) return { error: parsed.error };
  const { email } = parsed.data;

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, company_name")
    .eq("email", email)
    .maybeSingle<{ id: string; company_name: string }>();
  if (!profile) return { error: "No account found for this email." };

  const isSelf = email === session.email.toLowerCase();
  if (!isSelf && !(await isWorkspaceAdminOf(session.userId, profile.id))) return { error: "Unauthorized." };

  if (!(await rateLimit(`resend:${email}`, 3, 60 * 60))) {
    return { error: "Too many emails sent to this address. Try again later." };
  }

  const setupLink = await generateSetupLink(admin, email);
  if (!setupLink) return { error: "Could not generate a setup link. Please try again." };

  const sent = await sendEmail({
    to: email,
    subject: `Set up your Baghlabs Support Portal account — ${profile.company_name}`,
    html: buildReminderEmail({ companyName: profile.company_name, email, setupLink }),
  });
  if (!sent) return { error: "Failed to send email. Please try again." };
  return { success: true, message: "Setup email sent." };
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Generate a recovery link and rewrite it to go through our own callback. */
async function generateSetupLink(admin: SupabaseClient, email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${portalUrl()}/auth/callback?next=/set-password` },
  });
  if (error || !data?.properties?.hashed_token) {
    console.error("[generateSetupLink]", error?.message);
    return null;
  }
  const params = new URLSearchParams({
    token_hash: data.properties.hashed_token,
    type: "recovery",
    next: "/set-password",
  });
  return `${portalUrl()}/auth/callback?${params}`;
}

async function sendEmail(params: { to: string; subject: string; html: string }): Promise<boolean> {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({ from: FROM, ...params });
    if (error) {
      console.error("[sendEmail]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[sendEmail] exception:", e);
    return false;
  }
}

/** Register our webhook on the client's repo (best-effort; 422 = already exists). */
async function registerGitHubWebhook(githubRepo: string) {
  if (!hasGitHubToken()) return;
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[webhook-reg] GITHUB_WEBHOOK_SECRET not set — refusing to register an unsigned webhook.");
    return;
  }
  try {
    const res = await fetch(repoUrl(githubRepo, "/hooks"), {
      method: "POST",
      headers: githubHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        name: "web",
        active: true,
        events: ["issues"],
        config: {
          url: `${portalUrl()}/api/github-webhook`,
          content_type: "json",
          insecure_ssl: "0",
          secret,
        },
      }),
    });
    if (res.status === 422) return; // already registered
    if (!res.ok) console.error(`[webhook-reg] ${githubRepo}: HTTP ${res.status}`);
  } catch (e) {
    console.error(`[webhook-reg] ${githubRepo}:`, e);
  }
}

/** Import existing GitHub issues as tickets (best-effort). */
async function importGitHubIssues(admin: SupabaseClient, projectId: string, githubRepo: string) {
  if (!hasGitHubToken()) return;
  try {
    const issues = await listRepoIssues(githubRepo);
    if (!issues?.length) return;
    const rows = issues.map((issue) => ({
      project_id: projectId,
      title: issue.title,
      description: issue.body ?? "",
      status: issue.state === "closed" ? "closed" : "open",
      labels: issue.labels.map((l) => l.name),
      github_issue_number: issue.number,
    }));
    const { error } = await admin.from("tickets").insert(rows);
    if (error) console.error("[importGitHubIssues]", error.message);
  } catch (e) {
    console.error("[importGitHubIssues] exception:", e);
  }
}

// ─── Email templates ────────────────────────────────────────────────────────────

function emailShell(body: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:#141f59;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Baghlabs Support Portal</h1>
        </td></tr>
        <tr><td style="padding:40px;">${body}</td></tr>
        <tr><td style="border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:13px;">Baghlabs · If you have any issues accessing your account, reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;"><tr><td align="center">
    <a href="${escapeHtml(href)}" style="display:inline-block;background:#141f59;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">${label}</a>
  </td></tr></table>`;
}

function buildInvitationEmail(p: { companyName: string; email: string; setupLink: string; projectName: string }): string {
  const company = escapeHtml(p.companyName);
  return emailShell(`
    <h2 style="margin:0 0 16px;color:#141f59;font-size:20px;">Welcome, ${company}!</h2>
    <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
      Your support portal account has been set up and is ready to use.
      Click the button below to set your password and access your portal.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Your login email</p>
        <p style="margin:0;color:#141f59;font-size:14px;font-weight:600;">${escapeHtml(p.email)}</p>
      </td></tr>
    </table>
    <p style="margin:0 0 8px;color:#475569;font-size:15px;">
      Your first project <strong>${escapeHtml(p.projectName)}</strong> has been configured and is ready for tickets.
    </p>
    ${ctaButton(p.setupLink, "Set your password &amp; get started →")}
    <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;text-align:center;">
      This link expires in 24 hours. If it has expired, you can request a new one from the login page.
    </p>`, "Welcome to the Support Portal");
}

function buildReminderEmail(p: { companyName: string; email: string; setupLink: string }): string {
  return emailShell(`
    <h2 style="margin:0 0 16px;color:#141f59;font-size:20px;">Hi ${escapeHtml(p.companyName)}</h2>
    <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
      Here is a fresh link to set up your password for the Baghlabs Support Portal.
      Your login email is <strong>${escapeHtml(p.email)}</strong>.
    </p>
    ${ctaButton(p.setupLink, "Set your password &amp; get started →")}
    <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;text-align:center;">This link expires in 24 hours.</p>`,
    "Set up your Support Portal account");
}
