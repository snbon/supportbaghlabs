/**
 * Theme preference cookie — lets the root layout pick the right theme on the
 * server without a database call. The database (`profiles.theme`) remains the
 * source of truth; the cookie is a cache written at login and on change.
 */

import "server-only";
import { cookies } from "next/headers";
import { THEMES, type Theme } from "@/lib/types";

export const THEME_COOKIE = "theme";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export async function readThemeCookie(): Promise<Theme> {
  const raw = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(raw) ? raw : "system";
}

export async function setThemeCookie(theme: Theme): Promise<void> {
  (await cookies()).set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearThemeCookie(): Promise<void> {
  (await cookies()).delete(THEME_COOKIE);
}
