/**
 * Database types matching the Supabase schema.
 */

export type Theme = "light" | "dark" | "system";
export const THEMES: readonly Theme[] = ["light", "dark", "system"] as const;

/** Row in `profiles` (one-to-one with auth.users). */
export interface Profile {
  id: string;
  company_name: string;
  is_superadmin: boolean;
  /** Denormalised from auth.users via trigger. */
  email: string | null;
  /** Denormalised from auth.users.email_confirmed_at via trigger. */
  email_verified: boolean;
  theme: Theme;
  created_at: string;
}

/** Row in `projects`. */
export interface Project {
  id: string;
  client_id: string;
  project_name: string;
  github_repo: string; // "owner/repo"
  created_at: string;
}

/** Row in `tickets`. */
export interface Ticket {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string; // "open" | "closed"
  labels: string[];
  github_issue_number: number | null;
  created_at: string;
}

export type ProjectWithTickets = Project & { tickets: Ticket[] };
export type ProfileWithProjects = Profile & { projects: ProjectWithTickets[] };

/** Aggregated client row for the superadmin dashboard. */
export interface ClientWithStats {
  profile: Profile;
  projects: Project[];
  openTicketCount: number;
  totalTicketCount: number;
  emailVerified: boolean;
  email: string;
}
