/**
 * Authentication server actions.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/dal";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { clearThemeCookie, isTheme, setThemeCookie } from "@/lib/theme";
import { escapeHtml, forgotPasswordSchema, loginSchema, parseForm, passwordFormSchema } from "@/lib/validation";

export interface AuthState {
  error?: string;
  success?: boolean;
  message?: string;
}

const portalUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://support.baghlabs.com";

/** Log in with email and password. */
export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = parseForm(loginSchema, formData);
  if (!parsed.success) return { error: parsed.error };
  const { email, password } = parsed.data;

  const ip = await clientIp();
  if (!(await rateLimit(`login:${ip}`, 20, 15 * 60))) {
    return { error: "Too many sign-in attempts. Please wait a few minutes." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: "Invalid email or password." };
  }

  // Cache the account's theme preference in a cookie for flash-free rendering.
  const { data: profile } = await createAdminClient()
    .from("profiles").select("theme").eq("id", data.user.id).maybeSingle<{ theme: string }>();
  if (profile && isTheme(profile.theme)) await setThemeCookie(profile.theme);

  revalidatePath("/");
  redirect("/");
}

/** Log out and return to the login page. */
export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearThemeCookie();
  revalidatePath("/");
  redirect("/");
}

/** First-time password setup (via invite / recovery link). Marks the email confirmed. */
export async function setPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = parseForm(passwordFormSchema, formData);
  if (!parsed.success) return { error: parsed.error };

  const session = await getSession();
  if (!session) return { error: "Session expired. Please use your invite link again." };

  const supabase = await createClient();
  const { error: updateError } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (updateError) return { error: updateError.message };

  // Confirms the email; the DB trigger mirrors this into profiles.email_verified.
  await createAdminClient().auth.admin.updateUserById(session.userId, { email_confirm: true });

  revalidatePath("/");
  redirect("/");
}

/** Send a password-reset email. Always answers the same way to avoid enumeration. */
export async function forgotPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const neutral: AuthState = {
    success: true,
    message: "If that email is registered, you'll receive a reset link shortly.",
  };

  const parsed = parseForm(forgotPasswordSchema, formData);
  if (!parsed.success) return { error: parsed.error };
  const { email } = parsed.data;

  const ip = await clientIp();
  const [ipOk, emailOk] = await Promise.all([
    rateLimit(`forgot:ip:${ip}`, 5, 15 * 60),
    rateLimit(`forgot:email:${email}`, 3, 60 * 60),
  ]);
  if (!ipOk || !emailOk) return neutral;

  const admin = createAdminClient();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${portalUrl()}/auth/callback?next=/set-password` },
  });

  if (!linkError && linkData?.properties?.hashed_token) {
    const params = new URLSearchParams({
      token_hash: linkData.properties.hashed_token,
      type: "recovery",
      next: "/set-password",
    });
    const resetLink = `${portalUrl()}/auth/callback?${params}`;
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails
      .send({
        from: "Baghlabs Support <support@baghlabs.com>",
        to: email,
        subject: "Reset your Baghlabs Support Portal password",
        html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
          <div style="background:#141f59;border-radius:12px 12px 0 0;padding:24px 32px;">
            <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Baghlabs Support Portal</h1>
          </div>
          <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:32px;">
            <h2 style="margin:0 0 12px;color:#141f59;font-size:18px;">Reset your password</h2>
            <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">
              Click the button below to reset your password. This link expires in 24 hours.
            </p>
            <a href="${escapeHtml(resetLink)}"
               style="display:inline-block;background:#141f59;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
              Reset password →
            </a>
            <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </div>
        </div>`,
      })
      .catch((e) => console.error("[forgotPassword] Resend error:", e));
  }

  return neutral;
}

/** Change password for the signed-in user (profile page). */
export async function changePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = parseForm(passwordFormSchema, formData);
  if (!parsed.success) return { error: parsed.error };

  const session = await getSession();
  if (!session) return { error: "Session expired. Please sign in again." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  return { success: true, message: "Password updated successfully." };
}
