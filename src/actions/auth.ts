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

/** Shape returned from the login action to the form component. */
export interface AuthState {
  error?: string;
  success?: boolean;
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
