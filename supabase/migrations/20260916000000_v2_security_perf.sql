-- ============================================================
-- Migration: v2 security hardening + performance
-- ============================================================

-- ── profiles: denormalised auth fields + theme preference ─────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email          TEXT,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS theme          TEXT    NOT NULL DEFAULT 'system'
    CHECK (theme IN ('light', 'dark', 'system'));

-- Backfill from auth.users
UPDATE public.profiles p
SET    email          = u.email,
       email_verified = (u.email_confirmed_at IS NOT NULL)
FROM   auth.users u
WHERE  u.id = p.id;

-- Keep profiles.email / email_verified in sync with auth.users
CREATE OR REPLACE FUNCTION public.sync_profile_from_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET    email          = NEW.email,
         email_verified = (NEW.email_confirmed_at IS NOT NULL)
  WHERE  id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_auth_user();

-- ── Privilege escalation fix ──────────────────────────────────
-- The RLS update policy lets users update their own row, but nothing
-- stopped them from flipping is_superadmin. Restrict updatable columns.
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT  UPDATE (company_name, theme) ON public.profiles TO authenticated;

-- ── Indexes for the dashboard queries and webhook lookups ─────
CREATE INDEX IF NOT EXISTS projects_client_id_idx      ON public.projects (client_id);
CREATE INDEX IF NOT EXISTS projects_github_repo_idx    ON public.projects (github_repo);
CREATE INDEX IF NOT EXISTS tickets_project_created_idx ON public.tickets  (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tickets_project_issue_idx   ON public.tickets  (project_id, github_issue_number);

-- ── Rate limiting (fixed window, service-role only) ───────────
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          TEXT        PRIMARY KEY,
  count        INT         NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_key TEXT, p_limit INT, p_window INTERVAL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO public.rate_limits (key, count, window_start)
  VALUES (p_key, 1, now())
  ON CONFLICT (key) DO UPDATE
    SET count = CASE WHEN rate_limits.window_start < now() - p_window
                     THEN 1 ELSE rate_limits.count + 1 END,
        window_start = CASE WHEN rate_limits.window_start < now() - p_window
                            THEN now() ELSE rate_limits.window_start END
  RETURNING count INTO v_count;
  RETURN v_count <= p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INT, INTERVAL) FROM PUBLIC, anon, authenticated;

-- ── Webhook replay protection ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  delivery_id TEXT        PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.webhook_deliveries FROM anon, authenticated;

-- ── Storage: private bucket, per-user folders ─────────────────
UPDATE storage.buckets SET public = false WHERE id = 'ticket-attachments';

DROP POLICY IF EXISTS "ticket-attachments: auth upload" ON storage.objects;
CREATE POLICY "ticket-attachments: auth upload own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "ticket-attachments: public read" ON storage.objects;
CREATE POLICY "ticket-attachments: read own folder or superadmin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_superadmin())
  );
