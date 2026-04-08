/**
 * Client Management Server Actions — SUPERADMIN ONLY.
 *
 * These actions use the admin Supabase client (service role key) because
 * they need to create users and bypass RLS. They should NEVER be callable
 * from any component a regular client user can access.
 */

"use server";

import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

/** Shape returned from admin actions. */
export interface ClientActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

/**
 * inviteClient — creates a new client user and sends them an invitation email.
 *
 * Flow:
 * 1. Create a Supabase auth user via the admin API
 * 2. Insert a `profiles` row with their company name
 * 3. Insert a `projects` row with their first project
 * 4. Send a styled HTML invitation email via Resend
 */
export async function inviteClient(
  _prevState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  const adminSupabase = createAdminClient();

  const email       = formData.get("email")       as string;
  const companyName = formData.get("companyName") as string;
  const projectName = formData.get("projectName") as string;
  const githubRepo  = formData.get("githubRepo")  as string;

  if (!email || !companyName || !projectName || !githubRepo) {
    return { error: "All fields are required." };
  }

  // Step 1: Create the auth user using the admin API.
  // We generate a random internal password — the user will set their own via
  // the setup link. email_confirm is intentionally left false; it gets set to
  // true only after the user completes the password-setup flow.
  const tempPassword = crypto.randomUUID() + crypto.randomUUID();
  const { data: userData, error: createUserError } =
    await adminSupabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: false,
    });

  if (createUserError || !userData.user) {
    console.error("Create user error:", createUserError);
    return { error: createUserError?.message || "Failed to create user." };
  }

  const userId = userData.user.id;

  // Step 2: Insert the profile row
  const { error: profileError } = await adminSupabase
    .from("profiles")
    .insert({ id: userId, company_name: companyName, is_superadmin: false });

  if (profileError) {
    console.error("Profile insert error:", profileError);
    // Roll back: delete the auth user we just created
    await adminSupabase.auth.admin.deleteUser(userId);
    return { error: "Failed to create profile. User has been rolled back." };
  }

  // Step 3: Insert the first project
  const { data: projectData, error: projectError } = await adminSupabase
    .from("projects")
    .insert({ client_id: userId, project_name: projectName, github_repo: githubRepo })
    .select("id")
    .single();

  if (projectError || !projectData) {
    console.error("Project insert error:", projectError);
    return {
      error: "User created but project setup failed. Please add the project manually.",
    };
  }

  // Import any existing GitHub issues into the tickets table (best-effort)
  await importGitHubIssues(adminSupabase, projectData.id, githubRepo);

  // Register the webhook on the client's GitHub repo (best-effort)
  await registerGitHubWebhook(githubRepo);

  // Step 4: Generate a one-time setup link and send it via Resend.
  // Using type 'recovery' so the email_confirmed_at is NOT set on click —
  // it gets set only after the user successfully saves their password.
  const portalUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://support.baghlabs.com";
  const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${portalUrl}/auth/callback?next=/set-password` },
  });

  if (linkError || !linkData.properties?.action_link) {
    console.error("generateLink error:", linkError);
    revalidatePath("/");
    return {
      success: true,
      message: "Client created but setup link generation failed. Use 'Resend Invitation' from their dashboard.",
    };
  }

  // Use hashed_token (not action_link) so our own callback route handles the
  // OTP exchange via verifyOtp — avoids PKCE/implicit flow mismatches.
  const setupLink = `${portalUrl}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=recovery&next=/set-password`;

  const emailSent = await sendInvitationEmail({
    email,
    companyName,
    setupLink,
    portalUrl,
    projectName,
  });

  revalidatePath("/");
  if (!emailSent) {
    return {
      success: true,
      message: `Client created but email failed to send (check server logs for Resend error). Use 'Resend setup email' from their row.`,
    };
  }

  return {
    success: true,
    message: `${companyName} has been invited. Setup email sent to ${email}.`,
  };
}

/**
 * addProject — adds a new project for an existing client.
 */
export async function addProject(
  _prevState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  // Admin client — superadmin actions always bypass RLS
  const supabase = createAdminClient();

  const clientId    = formData.get("clientId")    as string;
  const projectName = formData.get("projectName") as string;
  const githubRepo  = formData.get("githubRepo")  as string;

  if (!clientId || !projectName || !githubRepo) {
    return { error: "All fields are required." };
  }

  const { data: projectData, error } = await supabase
    .from("projects")
    .insert({ client_id: clientId, project_name: projectName, github_repo: githubRepo })
    .select("id")
    .single();

  if (error || !projectData) {
    console.error("Add project error:", error);
    return { error: "Failed to add project. Please try again." };
  }

  // Import any existing GitHub issues (best-effort)
  await importGitHubIssues(supabase, projectData.id, githubRepo);

  // Register the webhook on the client's GitHub repo (best-effort)
  await registerGitHubWebhook(githubRepo);

  revalidatePath("/");
  return { success: true, message: `Project "${projectName}" added successfully.` };
}

/**
 * resendInvitation — resends the portal access email to an existing client.
 * Called from VerificationBanner; rate-limiting is enforced client-side (1 min).
 */
export async function resendInvitation(
  _prevState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  const email = formData.get("email") as string;
  if (!email) return { error: "Email is required." };

  const adminSupabase = createAdminClient();

  // Look up the user by email to get their profile
  const { data: { users }, error: listError } = await adminSupabase.auth.admin.listUsers();
  if (listError) return { error: "Could not look up account." };

  const authUser = users.find((u) => u.email === email);
  if (!authUser) return { error: "No account found for this email." };

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("company_name")
    .eq("id", authUser.id)
    .single();

  const portalUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://support.baghlabs.com";

  // Generate a fresh setup link for them
  const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${portalUrl}/auth/callback?next=/set-password` },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("generateLink error:", linkError);
    return { error: "Could not generate a setup link. Please try again." };
  }

  const setupLink = `${portalUrl}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=recovery&next=/set-password`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error: sendError } = await resend.emails.send({
    from: "Baghlabs Support <support@baghlabs.com>",
    to: email,
    subject: `Set up your Baghlabs Support Portal account — ${profile?.company_name ?? ""}`,
    html: buildReminderEmail({
      companyName: profile?.company_name ?? email,
      email,
      setupLink,
    }),
  });

  if (sendError) {
    console.error("Resend invitation error:", sendError);
    return { error: "Failed to send email. Please try again." };
  }

  return { success: true, message: "Setup email sent." };
}

// ─── GitHub Webhook Registration ───────────────────────────────────────────────

/**
 * Registers the support portal webhook on a GitHub repo so that issue events
 * (open, close, edit, label) are forwarded to our webhook handler.
 *
 * Best-effort: logs errors but does not fail the parent action.
 * If a webhook with the same URL already exists, GitHub returns 422 — ignored.
 * Requires GITHUB_PAT to have `admin:repo_hook` (or `write:repo_hook`) scope.
 */
async function registerGitHubWebhook(githubRepo: string) {
  const pat = process.env.GITHUB_PAT;
  if (!pat) {
    console.warn("[webhook-reg] GITHUB_PAT not set — skipping webhook registration.");
    return;
  }

  const webhookUrl =
    (process.env.NEXT_PUBLIC_SITE_URL || "https://support.baghlabs.com") +
    "/api/github-webhook";

  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  const body: Record<string, unknown> = {
    name: "web",
    active: true,
    events: ["issues"],
    config: {
      url: webhookUrl,
      content_type: "json",
      insecure_ssl: "0",
      ...(secret ? { secret } : {}),
    },
  };

  try {
    const res = await fetch(`https://api.github.com/repos/${githubRepo}/hooks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 422) {
      // Webhook already exists on this repo — nothing to do
      console.log(`[webhook-reg] Webhook already registered on ${githubRepo}`);
      return;
    }

    if (!res.ok) {
      console.error(
        `[webhook-reg] Failed to register webhook on ${githubRepo}:`,
        res.status,
        await res.text()
      );
      return;
    }

    console.log(`[webhook-reg] Webhook registered on ${githubRepo} → ${webhookUrl}`);
  } catch (e) {
    console.error(`[webhook-reg] Exception registering webhook on ${githubRepo}:`, e);
  }
}

// ─── GitHub Import ─────────────────────────────────────────────────────────────

/**
 * Fetches existing issues from a GitHub repo and inserts them as tickets.
 * This is best-effort — errors are logged but do not fail the parent action.
 * Pull requests are excluded (GitHub issues API returns them too).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importGitHubIssues(supabase: any, projectId: string, githubRepo: string) {
  try {
    // Fetch up to 100 issues (open + closed) — covers most repos
    const ghRes = await fetch(
      `https://api.github.com/repos/${githubRepo}/issues?state=all&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_PAT}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!ghRes.ok) {
      console.error("GitHub issues fetch failed:", ghRes.status, await ghRes.text());
      return;
    }

    const issues: Array<{
      number: number;
      title: string;
      body: string | null;
      state: string;
      labels: Array<{ name: string }>;
      pull_request?: unknown;
    }> = await ghRes.json();

    // Filter out pull requests
    const realIssues = issues.filter((i) => !i.pull_request);
    if (realIssues.length === 0) return;

    const rows = realIssues.map((issue) => ({
      project_id: projectId,
      title: issue.title,
      description: issue.body ?? "",
      status: issue.state === "closed" ? "closed" : "open",
      labels: issue.labels.map((l) => l.name),
      github_issue_number: issue.number,
    }));

    const { error } = await supabase.from("tickets").insert(rows);
    if (error) console.error("Ticket import error:", error);
    else console.log(`Imported ${rows.length} GitHub issues for project ${projectId}`);
  } catch (e) {
    console.error("importGitHubIssues exception:", e);
  }
}

// ─── Email Helpers ──────────────────────────────────────────────────────────────

/** Sends invitation email. Returns true on success, false on failure. */
async function sendInvitationEmail(params: {
  email: string;
  companyName: string;
  setupLink: string;
  portalUrl: string;
  projectName: string;
}): Promise<boolean> {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: "Baghlabs Support <support@baghlabs.com>",
      to: params.email,
      subject: `Welcome to the Baghlabs Support Portal — ${params.companyName}`,
      html: buildInvitationEmail(params),
    });
    if (error) {
      console.error("Resend email error:", JSON.stringify(error));
      return false;
    }
    return true;
  } catch (e) {
    console.error("Resend exception:", e);
    return false;
  }
}

// ─── Email Template ────────────────────────────────────────────────────────────

/** Builds a styled HTML invitation email. */
function buildInvitationEmail(params: {
  companyName: string;
  email: string;
  setupLink: string;
  portalUrl: string;
  projectName: string;
}): string {
  const { companyName, email, setupLink, projectName } = params;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to the Support Portal</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background:#0f172a;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
                Baghlabs Support Portal
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">
                Welcome, ${companyName}!
              </h2>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                Your support portal account has been set up and is ready to use.
                Click the button below to set your password and access your portal.
              </p>

              <!-- Login info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Your login email</p>
                    <p style="margin:0;color:#0f172a;font-size:14px;font-weight:600;">${email}</p>
                  </td>
                </tr>
              </table>

              <!-- Project Info -->
              <p style="margin:0 0 8px;color:#475569;font-size:15px;">
                Your first project <strong>${projectName}</strong> has been configured and is ready for tickets.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
                <tr>
                  <td align="center">
                    <a href="${setupLink}"
                       style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                      Set your password &amp; get started →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;text-align:center;">
                This link expires in 24 hours. If it has expired, you can request a new one from the login page.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:13px;">
                Baghlabs · If you have any issues accessing your account, reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/** Builds a styled HTML resend email with a fresh setup link. */
function buildReminderEmail(params: {
  companyName: string;
  email: string;
  setupLink: string;
}): string {
  const { companyName, email, setupLink } = params;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Set up your Support Portal account</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:#0f172a;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">
                Baghlabs Support Portal
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">
                Hi ${companyName}
              </h2>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                Here is a fresh link to set up your password for the Baghlabs Support Portal.
                Your login email is <strong>${email}</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                <tr>
                  <td align="center">
                    <a href="${setupLink}"
                       style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                      Set your password &amp; get started →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;text-align:center;">
                This link expires in 24 hours.
              </p>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #e2e8f0;padding:24px 40px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:13px;">
                Baghlabs · If you have any issues accessing your account, reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
