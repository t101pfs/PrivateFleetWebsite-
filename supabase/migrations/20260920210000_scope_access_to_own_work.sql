-- Everyone sees only their own work; Admins see everything.
--
--   Operations: the flights they accepted, plus brand-new unaccepted requests
--               (the queue, so they can accept one). Nothing accepted by
--               another Ops person, nothing escalated to Admin.
--   Sales:      the leads and flights they own, created or are on the team of.
--   Chats:      only the ones you are a member of, and people can no longer
--               add themselves to somebody else's chat.
--
-- Until now several tables let every Ops (flights, options, documents,
-- quotes) or every Sales (leads, lead activity, quotes) read everything, and
-- any signed-in user could add themselves to any lead's team.

-- ------------------------------------------------------------ helper functions

CREATE OR REPLACE FUNCTION public.can_access_flight(_flight_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.flight_requests fr
    LEFT JOIN public.leads l ON l.id = fr.lead_id
    WHERE fr.id = _flight_id
      AND (
        public.is_admin(auth.uid())
        OR (public.has_role(auth.uid(), 'sales'::app_role) AND fr.created_by = auth.uid())
        OR (public.has_role(auth.uid(), 'sales'::app_role) AND l.assigned_to = auth.uid())
        OR (public.has_role(auth.uid(), 'sales'::app_role) AND l.created_by = auth.uid())
        OR (public.has_role(auth.uid(), 'sales'::app_role) AND EXISTS (
              SELECT 1 FROM public.lead_team_members ltm
              WHERE ltm.lead_id = fr.lead_id AND ltm.user_id = auth.uid()
            ))
        OR (
          public.has_role(auth.uid(), 'operations'::app_role)
          AND fr.status_sales <> 'draft'
          AND (
            fr.assigned_ops_id = auth.uid()
            OR (fr.assigned_ops_id IS NULL AND fr.status_ops = 'new' AND fr.ops_lockout_at IS NULL)
          )
        )
      )
  )
$function$;

CREATE OR REPLACE FUNCTION public.can_access_lead(_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = _lead_id
      AND (
        public.is_admin(auth.uid())
        OR l.assigned_to = auth.uid()
        OR l.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.lead_team_members m
          WHERE m.lead_id = _lead_id AND m.user_id = auth.uid()
        )
      )
  )
$function$;

-- ------------------------------------------------------------------- flights

DROP POLICY IF EXISTS "Operations can view posted flights" ON public.flight_requests;
CREATE POLICY "Operations see their flights and the queue"
  ON public.flight_requests FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'operations')
    AND status_sales <> 'draft'
    AND (
      assigned_ops_id = auth.uid()
      OR (assigned_ops_id IS NULL AND status_ops = 'new' AND ops_lockout_at IS NULL)
    )
  );

DROP POLICY IF EXISTS "Operations can update flights" ON public.flight_requests;
CREATE POLICY "Operations update their flights and accept from the queue"
  ON public.flight_requests FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'operations')
    AND status_sales <> 'draft'
    AND (
      assigned_ops_id = auth.uid()
      OR (assigned_ops_id IS NULL AND status_ops = 'new' AND ops_lockout_at IS NULL)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'operations')
    AND status_sales <> 'draft'
    AND (assigned_ops_id = auth.uid() OR assigned_ops_id IS NULL)
  );

-- ------------------------------------------------------------ flight options

DROP POLICY IF EXISTS "Operations can manage flight options" ON public.flight_options;
CREATE POLICY "Operations manage options on their flights"
  ON public.flight_options FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'operations') AND public.can_access_flight(flight_id))
  WITH CHECK (public.has_role(auth.uid(), 'operations') AND public.can_access_flight(flight_id));
CREATE POLICY "Admins manage all flight options"
  ON public.flight_options FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- --------------------------------------------------------- flight documents

DROP POLICY IF EXISTS "Operations and admin can view flight documents" ON public.flight_documents;
CREATE POLICY "Operations and admin can view flight documents"
  ON public.flight_documents FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (public.has_role(auth.uid(), 'operations') AND public.can_access_flight(flight_id::uuid))
  );

DROP POLICY IF EXISTS "Operations and admin can insert flight documents" ON public.flight_documents;
CREATE POLICY "Operations and admin can insert flight documents"
  ON public.flight_documents FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND (
      public.is_admin(auth.uid())
      OR (public.has_role(auth.uid(), 'operations') AND public.can_access_flight(flight_id::uuid))
    )
  );

-- -------------------------------------------------------------------- quotes

DROP POLICY IF EXISTS "Operations can manage quotes" ON public.quotes;
DROP POLICY IF EXISTS "Sales can manage quotes" ON public.quotes;

CREATE POLICY "Sales manage their own quotes"
  ON public.quotes FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'sales')
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.flight_requests fr
        WHERE fr.quotation_id = quotes.id AND public.can_access_flight(fr.id)
      )
    )
  )
  WITH CHECK (public.has_role(auth.uid(), 'sales') AND created_by = auth.uid());

CREATE POLICY "Operations see quotes on their flights"
  ON public.quotes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'operations')
    AND EXISTS (
      SELECT 1 FROM public.flight_requests fr
      WHERE fr.quotation_id = quotes.id AND public.can_access_flight(fr.id)
    )
  );

-- -------------------------------------------------------------------- leads

DROP POLICY IF EXISTS "Sales can manage leads" ON public.leads;
CREATE POLICY "Sales manage their own leads"
  ON public.leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'sales') AND public.can_access_lead(id))
  WITH CHECK (
    public.has_role(auth.uid(), 'sales')
    AND (created_by = auth.uid() OR assigned_to = auth.uid() OR public.can_access_lead(id))
  );

DROP POLICY IF EXISTS "Sales can manage lead activities" ON public.lead_activities;
CREATE POLICY "Sales manage activities on their leads"
  ON public.lead_activities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'sales') AND public.can_access_lead(lead_id))
  WITH CHECK (public.has_role(auth.uid(), 'sales') AND public.can_access_lead(lead_id));

DROP POLICY IF EXISTS "Operations can view lead activities" ON public.lead_activities;
CREATE POLICY "Operations view activities on their chats"
  ON public.lead_activities FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operations') AND public.can_access_lead(lead_id));

-- ------------------------------------------------------ extension requests

DROP POLICY IF EXISTS "Staff can view extension requests" ON public.deadline_extension_requests;
CREATE POLICY "Staff view extension requests on their flights"
  ON public.deadline_extension_requests FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.can_access_flight(flight_id));

-- -------------------------------------------------------------- chat access

-- Anyone used to be able to add THEMSELVES to any lead's team (and so read its
-- chat and flight). Now: Admins, the lead's owner/creator and existing members
-- can add people; and you can add yourself only when you are the Ops person
-- who accepted a flight on that lead, or the Sales person who filed one.
DROP POLICY IF EXISTS "Members can add self or owner/admin/team adds anyone" ON public.lead_team_members;
CREATE POLICY "Team is added by owner, admin, members or the accepting Ops"
  ON public.lead_team_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_team_members.lead_id AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.lead_team_members m
      WHERE m.lead_id = lead_team_members.lead_id AND m.user_id = auth.uid()
    )
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.flight_requests fr
        WHERE fr.lead_id = lead_team_members.lead_id
          AND (fr.assigned_ops_id = auth.uid() OR fr.created_by = auth.uid())
      )
    )
  );
