-- ============================================================
-- Migration: superadmin workspaces
-- Superadmins only see and manage clients in their own workspace.
-- Real accounts live in 'baghlabs'; QA seed accounts live in 'seed'.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS workspace TEXT NOT NULL DEFAULT 'baghlabs';
CREATE INDEX IF NOT EXISTS profiles_workspace_idx ON public.profiles (workspace);

-- Workspace of the calling user (used by RLS, bypasses RLS itself)
CREATE OR REPLACE FUNCTION public.current_workspace()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace FROM profiles WHERE id = auth.uid();
$$;

-- Is the caller a superadmin of the workspace that owns this client profile?
CREATE OR REPLACE FUNCTION public.is_workspace_admin_of(client_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles me
    JOIN profiles client ON client.id = client_profile_id
    WHERE me.id = auth.uid()
      AND me.is_superadmin = true
      AND client.workspace = me.workspace
  );
$$;

-- ── Re-scope the superadmin policies ──────────────────────────
DROP POLICY IF EXISTS "profiles: superadmin read all" ON public.profiles;
CREATE POLICY "profiles: superadmin read workspace"
  ON public.profiles FOR SELECT
  USING (is_superadmin() AND workspace = current_workspace());

DROP POLICY IF EXISTS "profiles: superadmin insert" ON public.profiles;
CREATE POLICY "profiles: superadmin insert workspace"
  ON public.profiles FOR INSERT
  WITH CHECK (is_superadmin() AND workspace = current_workspace());

DROP POLICY IF EXISTS "projects: client or superadmin read" ON public.projects;
CREATE POLICY "projects: client or workspace admin read"
  ON public.projects FOR SELECT
  USING (client_id = auth.uid() OR is_workspace_admin_of(client_id));

DROP POLICY IF EXISTS "projects: superadmin insert" ON public.projects;
CREATE POLICY "projects: workspace admin insert"
  ON public.projects FOR INSERT
  WITH CHECK (is_workspace_admin_of(client_id));

DROP POLICY IF EXISTS "projects: superadmin update" ON public.projects;
CREATE POLICY "projects: workspace admin update"
  ON public.projects FOR UPDATE
  USING (is_workspace_admin_of(client_id));

DROP POLICY IF EXISTS "tickets: client or superadmin read" ON public.tickets;
CREATE POLICY "tickets: client or workspace admin read"
  ON public.tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tickets.project_id
        AND (projects.client_id = auth.uid() OR is_workspace_admin_of(projects.client_id))
    )
  );

DROP POLICY IF EXISTS "tickets: superadmin update" ON public.tickets;
CREATE POLICY "tickets: workspace admin update"
  ON public.tickets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tickets.project_id
        AND is_workspace_admin_of(projects.client_id)
    )
  );
