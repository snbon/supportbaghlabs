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

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const companyName = formData.get("companyName") as string;
  const projectName = formData.get("projectName") as string;
  const githubRepo = formData.get("githubRepo") as string;

  if (!email || !password || !companyName || !projectName || !githubRepo) {
    return { error: "All fields are required." };
  }

  // Step 1: Create the auth user using the admin API
  // email_confirm: true skips the confirmation email (we send our own)
  const { data: userData, error: createUserError } =
    await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
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
  const { error: projectError } = await adminSupabase.from("projects").insert({
    client_id: userId,
    project_name: projectName,
    github_repo: githubRepo,
  });

  if (projectError) {
    console.error("Project insert error:", projectError);
    // Profile was created — notify but don't fully roll back
    return {
      error: "User created but project setup failed. Please add the project manually.",
    };
  }

  // Step 4: Send the invitation email via Resend
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const portalUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://support.baghlabs.com";

    await resend.emails.send({
      from: "Baghlabs Support <support@baghlabs.com>",
      to: email,
      subject: `Welcome to the Baghlabs Support Portal — ${companyName}`,
      html: buildInvitationEmail({ companyName, email, password, portalUrl, projectName }),
    });
  } catch (emailError) {
    console.error("Email send error:", emailError);
    // User and project were created — just warn about email
    revalidatePath("/");
    return {
      success: true,
      message: "Client created successfully but invitation email failed to send.",
    };
  }

  revalidatePath("/");
  return {
    success: true,
    message: `${companyName} has been invited. They'll receive an email at ${email}.`,
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

  const { error } = await supabase.from("projects").insert({
    client_id: clientId,
    project_name: projectName,
    github_repo: githubRepo,
  });

  if (error) {
    console.error("Add project error:", error);
    return { error: "Failed to add project. Please try again." };
  }

  revalidatePath("/");
  return { success: true, message: `Project "${projectName}" added successfully.` };
}

// ─── Email Template ────────────────────────────────────────────────────────────

/** Builds a styled HTML invitation email. */
function buildInvitationEmail(params: {
  companyName: string;
  email: string;
  password: string;
  portalUrl: string;
  projectName: string;
}): string {
  const { companyName, email, password, portalUrl, projectName } = params;

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
                Welcome, ${companyName}! 👋
              </h2>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                Your support portal account has been set up and is ready to use.
                You can now submit tickets, track their progress, and communicate
                with our team — all in one place.
              </p>

              <!-- Credentials Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Your Login Credentials</p>
                    <p style="margin:0 0 12px;color:#0f172a;font-size:14px;"><strong>Email:</strong> ${email}</p>
                    <p style="margin:0 0 16px;color:#0f172a;font-size:14px;"><strong>Temporary Password:</strong> <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;font-family:monospace;">${password}</code></p>
                    <p style="margin:0;color:#64748b;font-size:13px;">⚠️ Please change your password after your first login.</p>
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
                    <a href="${portalUrl}"
                       style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                      Access Your Support Portal →
                    </a>
                  </td>
                </tr>
              </table>
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
