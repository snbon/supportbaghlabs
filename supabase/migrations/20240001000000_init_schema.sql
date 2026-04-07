-- ============================================================
-- Migration: Initial schema
-- Tables: profiles, projects, tickets
-- ============================================================

-- ── profiles ──────────────────────────────────────────────
-- One row per user, extends auth.users.
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name  TEXT        NOT NULL,
  is_superadmin BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── projects ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_name TEXT        NOT NULL,
  github_repo  TEXT        NOT NULL, -- format: "owner/repo"
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── tickets ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title               TEXT        NOT NULL,
  description         TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'open',
  labels              TEXT[]      NOT NULL DEFAULT '{}',
  github_issue_number INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
