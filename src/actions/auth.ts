/**
 * Authentication Server Actions.
 *
 * These run on the server and manage the user's Supabase session.
 * They are bound to forms in Client Components via `useActionState`.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

/** Shape returned from the login action to the form component. */
export interface AuthState {
  error?: string;
  success?: boolean;
  message?: string;
}

/**
 * Log in with email and password.
 * On success, revalidates the root page so the dashboard re-renders.
 * On failure, returns an error message to display in the form.
 */
export async function login(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Revalidate and redirect to re-render the root page as logged-in
  revalidatePath("/");
  redirect("/");
}

/**
 * Log out the current user.
 * Clears the session and redirects to the root page (which shows the login form).
 */
export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect("/");
}

/**
 * Set a new password for the currently logged-in user (first-time setup).
 * After the password is saved, the user's email is marked as confirmed so they
 * show as "verified" in both the client dashboard and superadmin panel.
 */
export async function setPassword(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const password = formData.get("password") as string;
  const confirm  = formData.get("confirm")  as string;

  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Session expired. Please use your invite link again." };

  // Update the password
  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) return { error: updateError.message };

  // Mark email as confirmed — this is what makes them "verified"
  const adminSupabase = createAdminClient();
  await adminSupabase.auth.admin.updateUserById(user.id, { email_confirm: true });

  revalidatePath("/");
  redirect("/");
}

/**
 * Send a password-reset email to the given address.
 * Always returns success to avoid revealing whether the email is registered.
 */
export async function forgotPassword(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get("email") as string;
  if (!email) return { error: "Email is required." };

  const adminSupabase = createAdminClient();
  const portalUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://support.baghlabs.com";

  const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${portalUrl}/auth/callback?next=/set-password` },
  });

  if (!linkError && linkData?.properties?.hashed_token) {
    const resetLink = `${portalUrl}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=recovery&next=/set-password`;
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Baghlabs Support <support@baghlabs.com>",
      to: email,
      subject: "Reset your Baghlabs Support Portal password",
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
          <div style="background:#0f172a;border-radius:12px 12px 0 0;padding:24px 32px;">
            <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Baghlabs Support Portal</h1>
          </div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:32px;">
            <h2 style="margin:0 0 12px;color:#0f172a;font-size:18px;">Reset your password</h2>
            <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">
              Click the button below to reset your password. This link expires in 24 hours.
            </p>
            <a href="${resetLink}"
               style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
              Reset password →
            </a>
            <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    }).catch((e) => console.error("[forgotPassword] Resend error:", e));
  }

  return {
    success: true,
    message: "If that email is registered, you'll receive a reset link shortly.",
  };
}

/**
 * Change the password for the currently logged-in user (from the profile page).
 */
export async function changePassword(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const password = formData.get("password") as string;
  const confirm  = formData.get("confirm")  as string;

  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Session expired. Please sign in again." };

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) return { error: updateError.message };

  return { success: true, message: "Password updated successfully." };
}
