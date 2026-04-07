-- ============================================================
-- Migration: Superadmin user setup
--
-- This upserts the superadmin profile row for the account
-- that already exists in auth.users.
--
-- HOW TO USE:
--   Replace the email below with your own, then push.
--   The DO block looks up your UID from auth.users automatically
--   so you never have to copy-paste a UUID.
-- ============================================================

DO $$
DECLARE
  v_uid UUID;
BEGIN
  -- Look up UID by email
  SELECT id INTO v_uid
  FROM auth.users
  WHERE email = 'sweaniz@icloud.com'  -- ← change this to your email
  LIMIT 1;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No auth user found with that email. Create the user in Supabase Auth first.';
  END IF;

  INSERT INTO public.profiles (id, company_name, is_superadmin)
  VALUES (v_uid, 'Baghlabs', true)
  ON CONFLICT (id) DO UPDATE
    SET is_superadmin = true,
        company_name  = 'Baghlabs';

  RAISE NOTICE 'Superadmin profile set for UID: %', v_uid;
END;
$$;
