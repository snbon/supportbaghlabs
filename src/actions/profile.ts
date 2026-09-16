"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/dal";
import { setThemeCookie } from "@/lib/theme";
import { updateThemeSchema } from "@/lib/validation";
import type { Theme } from "@/lib/types";

export interface ThemeState {
  error?: string;
  theme?: Theme;
}

/** Persist the account's theme preference (database + cookie). */
export async function updateTheme(theme: string): Promise<ThemeState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated." };

  const parsed = updateThemeSchema.safeParse({ theme });
  if (!parsed.success) return { error: "Invalid theme." };
  const value = parsed.data.theme as Theme;

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ theme: value })
    .eq("id", session.userId);
  if (error) {
    console.error("[updateTheme]", error.message);
    return { error: "Could not save your preference." };
  }

  await setThemeCookie(value);
  return { theme: value };
}
