/**
 * Input validation schemas (zod v4) shared by server actions and route handlers.
 */

import { z } from "zod";
import { THEMES } from "@/lib/types";

export const githubRepoSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, "GitHub repo must be in the form owner/repo.");

export const emailSchema = z
  .email("Enter a valid email address.")
  .max(254)
  .transform((e) => e.toLowerCase());

export const uuidSchema = z.uuid("Invalid identifier.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.");

export const themeSchema = z.enum(THEMES as [string, ...string[]]);
export const ticketStatusSchema = z.enum(["open", "closed"]);

const shortText = (label: string, max = 120) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required.").max(128),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const passwordFormSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match.", path: ["confirm"] });

export const inviteClientSchema = z.object({
  email: emailSchema,
  companyName: shortText("Company name"),
  projectName: shortText("Project name"),
  githubRepo: githubRepoSchema,
});

export const addProjectSchema = z.object({
  clientId: uuidSchema,
  projectName: shortText("Project name"),
  githubRepo: githubRepoSchema,
});

export const resendInvitationSchema = z.object({ email: emailSchema });

export const submitTicketSchema = z.object({
  projectId: uuidSchema,
  title: shortText("Title", 200),
  description: shortText("Description", 10_000),
});

export const commentSchema = z.object({
  ticketId: uuidSchema,
  body: shortText("Comment", 10_000),
});

export const updateThemeSchema = z.object({ theme: themeSchema });

/** Parse FormData against a schema; returns the first validation message on failure. */
export function parseForm<T>(
  schema: z.ZodType<T>,
  formData: FormData
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Invalid input." };
  }
  return { success: true, data: result.data };
}

/** Only allow same-origin relative redirects (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

/** Escape a string for safe interpolation into HTML (email templates). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
