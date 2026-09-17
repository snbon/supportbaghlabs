/**
 * Data Access Layer — the single place where the server learns who the caller
 * is and loads data on their behalf.
 *
 * Every server action and route handler MUST go through `getSession()` /
 * `getSuperadminSession()` / `getTicketForUser()` before touching data. The
 * proxy only refreshes cookies; it is not an authorization boundary.
 *
 * All functions are wrapped in React `cache()` so a page, its layout and any
 * nested server components share one result per request.
 */

import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, ProfileWithProjects, Project, Ticket } from "@/lib/types";

export interface Session {
  userId: string;
  email: string;
}

/** Verified session from the auth cookie (local JWT verification when possible). */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return {
    userId: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : "",
  };
});

/** The caller's profile row (one query per request). */
export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single<Profile>();
  return data;
});

export async function isSuperadmin(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  return profile?.is_superadmin === true;
}

/** True when `userId` is a superadmin of the workspace that owns `clientId`. */
export async function isWorkspaceAdminOf(userId: string, clientId: string): Promise<boolean> {
  const me = await getProfile(userId);
  if (!me?.is_superadmin) return false;
  const { data: client } = await createAdminClient()
    .from("profiles").select("workspace").eq("id", clientId).maybeSingle<{ workspace: string }>();
  return client?.workspace === me.workspace;
}

/** Session only when the caller is a superadmin; otherwise null. */
export async function getSuperadminSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  return (await isSuperadmin(session.userId)) ? session : null;
}

const DASHBOARD_SELECT = "*, projects(*, tickets(*))";

/** Everything the client dashboard needs, in one round trip. */
export const getClientDashboardData = cache(
  async (userId: string): Promise<ProfileWithProjects | null> => {
    const { data, error } = await createAdminClient()
      .from("profiles")
      .select(DASHBOARD_SELECT)
      .eq("id", userId)
      .order("project_name", { referencedTable: "projects" })
      .order("created_at", { ascending: false, referencedTable: "projects.tickets" })
      .single<ProfileWithProjects>();
    if (error) {
      console.error("[dal] getClientDashboardData:", error.message);
      return null;
    }
    return data;
  }
);

/** Everything the superadmin dashboard needs (clients of one workspace), in one round trip. */
export const getSuperadminDashboardData = cache(async (workspace: string): Promise<ProfileWithProjects[]> => {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select(DASHBOARD_SELECT)
    .eq("is_superadmin", false)
    .eq("workspace", workspace)
    .order("company_name")
    .order("project_name", { referencedTable: "projects" })
    .order("created_at", { ascending: false, referencedTable: "projects.tickets" })
    .overrideTypes<ProfileWithProjects[], { merge: false }>();
  if (error) {
    console.error("[dal] getSuperadminDashboardData:", error.message);
    return [];
  }
  return data ?? [];
});

export interface TicketWithProject {
  ticket: Ticket;
  project: Project;
}

/**
 * Load a ticket together with its project, but only if the caller owns the
 * project or is a superadmin. Returns null otherwise (no distinction between
 * "not found" and "forbidden" to avoid leaking existence).
 */
export async function getTicketForUser(
  ticketId: string,
  session: Session
): Promise<TicketWithProject | null> {
  const { data } = await createAdminClient()
    .from("tickets")
    .select("*, project:projects(*)")
    .eq("id", ticketId)
    .single<Ticket & { project: Project | null }>();
  if (!data?.project) return null;

  const { project, ...ticket } = data;
  if (project.client_id !== session.userId && !(await isWorkspaceAdminOf(session.userId, project.client_id))) {
    return null;
  }
  return { ticket, project };
}
