-- Lead-level Team Chat: messages become lead-scoped (flight_id kept,
-- nullable, for historical flight conversations), system-authored
-- messages, and explicit team membership with role labels.

ALTER TABLE public.messages
  ALTER COLUMN flight_id DROP NOT NULL,
  ALTER COLUMN sender_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_flight_or_lead_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_flight_or_lead_check CHECK (flight_id IS NOT NULL OR lead_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON public.messages(lead_id);

-- Team membership
CREATE TABLE IF NOT EXISTS public.lead_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role_label TEXT,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lead_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_team_members_lead_id ON public.lead_team_members(lead_id);
ALTER TABLE public.lead_team_members ENABLE ROW LEVEL SECURITY;

-- Regular users can't see other users' rows in user_roles (RLS restricts
-- that to admins only), so auto-adding admins to a lead's team needs a
-- SECURITY DEFINER function — mirrors the existing get_operations_user_ids().
CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role IN ('admin'::app_role, 'super_admin'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.can_access_lead(_lead_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = _lead_id
      AND (
        public.is_admin(auth.uid())
        OR l.assigned_to = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.lead_team_members m
          WHERE m.lead_id = _lead_id AND m.user_id = auth.uid()
        )
      )
  )
$$;

DROP POLICY IF EXISTS "Team members can view lead team" ON public.lead_team_members;
CREATE POLICY "Team members can view lead team" ON public.lead_team_members
  FOR SELECT USING (public.can_access_lead(lead_id));

-- Anyone can add THEMSELVES (covers an ops rep auto-joining when they
-- accept a linked flight request, or a sales rep filing on the owner's
-- behalf) — only the lead owner/admin can add OTHER people, matching the
-- mockup's owner/admin-gated "Manage Members" control.
DROP POLICY IF EXISTS "Members can add self or owner/admin adds anyone" ON public.lead_team_members;
CREATE POLICY "Members can add self or owner/admin adds anyone" ON public.lead_team_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid())
  );

DROP POLICY IF EXISTS "Owner and admin can remove members" ON public.lead_team_members;
CREATE POLICY "Owner and admin can remove members" ON public.lead_team_members
  FOR DELETE
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid())
  );

DROP POLICY IF EXISTS "Users can view lead messages" ON public.messages;
CREATE POLICY "Users can view lead messages" ON public.messages
  FOR SELECT USING (lead_id IS NOT NULL AND public.can_access_lead(lead_id));

DROP POLICY IF EXISTS "Users can send lead messages" ON public.messages;
CREATE POLICY "Users can send lead messages" ON public.messages
  FOR INSERT WITH CHECK (
    lead_id IS NOT NULL
    AND public.can_access_lead(lead_id)
    AND (auth.uid() = sender_id OR (sender_id IS NULL AND is_system = true))
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_team_members;
