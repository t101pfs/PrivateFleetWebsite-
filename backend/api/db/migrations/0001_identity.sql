-- Ported from supabase/migrations/20260106142740_e01840c4-a3be-4278-8541-b700728a2eb0.sql
-- (Phase 1 scope: profiles + user_roles only. audit_logs/system_settings
-- deferred to Phase 2.)
--
-- Changes from the Supabase original:
--   * New `users` table added as the FK anchor, since RDS has no `auth.users`.
--   * profiles.user_id / user_roles.user_id reference public.users(id)
--     instead of auth.users(id). No other DDL changes to these two tables.
--   * RLS policies, has_role()/is_admin() SQL functions, and the
--     handle_new_user() trigger on auth.users are NOT ported: RLS/auth.uid()
--     has no equivalent on plain RDS. Authorization moves to the API layer
--     (see backend/api/src/lib/authz.ts). User provisioning becomes explicit
--     orchestration in the admin-create-user endpoint (Phase 2), not a
--     database trigger.

CREATE TYPE app_role AS ENUM ('sales', 'operations', 'admin', 'super_admin');

-- Anchor table: one row per Cognito user (id = Cognito `sub`).
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'sales',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
