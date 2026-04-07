/**
 * Database types matching the Supabase schema.
 * These interfaces mirror the table columns exactly so TypeScript
 * can catch any mismatches between the DB and our UI code.
 */

/** Represents a row in the `profiles` table (one-to-one with auth.users). */
export interface Profile {
  id: string; // uuid, references auth.users.id
  company_name: string;
  is_superadmin: boolean;
}

/** Represents a row in the `projects` table. */
export interface Project {
  id: string; // uuid
  client_id: string; // uuid, references profiles.id
  project_name: string;
  github_repo: string; // format: "owner/repo-name"
}

/** Represents a row in the `tickets` table. */
export interface Ticket {
  id: string; // uuid
  project_id: string; // uuid, references projects.id
  title: string;
  description: string;
  status: string; // "open" | "closed" | "in_progress" etc.
  labels: string[]; // array of label strings, e.g. ["bug", "working on it"]
  github_issue_number?: number; // stored when ticket is created, used by webhook
}

/**
 * Extended client type used in the Superadmin dashboard.
 * Joins profile with aggregated project/ticket data.
 */
export interface ClientWithStats {
  profile: Profile;
  projects: Project[];
  openTicketCount: number;
  totalTicketCount: number;
  emailVerified: boolean;
  email: string;
}
