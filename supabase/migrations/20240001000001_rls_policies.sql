-- ============================================================
-- Migration: Row Level Security policies
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets  ENABLE ROW LEVEL SECURITY;

-- ── Helper: is the current user a superadmin? ──────────────
-- Using a SECURITY DEFINER function avoids the recursive RLS
-- problem (a policy on `profiles` that queries `profiles`).
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER  -- runs as the function owner, bypasses RLS
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_superadmin = true
  );
$$;

-- ── profiles policies ─────────────────────────────────────
-- Anyone authenticated can read their own row.
CREATE POLICY "profiles: users read own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Superadmins can read all profiles.
CREATE POLICY "profiles: superadmin read all"
  ON profiles FOR SELECT
  USING (is_superadmin());

-- Superadmins can insert new profiles (when inviting clients).
CREATE POLICY "profiles: superadmin insert"
  ON profiles FOR INSERT
  WITH CHECK (is_superadmin());

-- Users can update their own profile (e.g. change company name).
CREATE POLICY "profiles: users update own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ── projects policies ─────────────────────────────────────
-- Clients can read their own projects; superadmins read all.
CREATE POLICY "projects: client or superadmin read"
  ON projects FOR SELECT
  USING (client_id = auth.uid() OR is_superadmin());

-- Only superadmins can create/update projects.
CREATE POLICY "projects: superadmin insert"
  ON projects FOR INSERT
  WITH CHECK (is_superadmin());

CREATE POLICY "projects: superadmin update"
  ON projects FOR UPDATE
  USING (is_superadmin());

-- ── tickets policies ──────────────────────────────────────
-- Clients can read tickets for their own projects; superadmins read all.
CREATE POLICY "tickets: client or superadmin read"
  ON tickets FOR SELECT
  USING (
    is_superadmin()
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tickets.project_id
        AND projects.client_id = auth.uid()
    )
  );

-- Clients can submit tickets only for their own projects.
CREATE POLICY "tickets: client insert own project"
  ON tickets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tickets.project_id
        AND projects.client_id = auth.uid()
    )
  );

-- Superadmins (and the webhook via service role) can update tickets.
CREATE POLICY "tickets: superadmin update"
  ON tickets FOR UPDATE
  USING (is_superadmin());
