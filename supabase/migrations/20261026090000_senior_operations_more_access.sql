-- Same gap as 20261024090000 (Senior Operations never got added to several
-- checks when the role was created), surfacing again live: Yousif couldn't
-- add an operator ("new row violates row-level security policy for table
-- operators"). Sweeping the rest of the confirmed gaps in one pass.

DROP POLICY IF EXISTS "Operations can manage operators" ON public.operators;
CREATE POLICY "Operations can manage operators" ON public.operators
  FOR ALL USING (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations'));

DROP POLICY IF EXISTS "Operations and admin can view flight documents" ON public.flight_documents;
CREATE POLICY "Operations and admin can view flight documents"
  ON public.flight_documents FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR ((public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations')) AND public.can_access_flight(flight_id::uuid))
  );

DROP POLICY IF EXISTS "Operations and admin can insert flight documents" ON public.flight_documents;
CREATE POLICY "Operations and admin can insert flight documents"
  ON public.flight_documents FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND (
      public.is_admin(auth.uid())
      OR ((public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations')) AND public.can_access_flight(flight_id::uuid))
    )
  );

DROP POLICY IF EXISTS "Operations and admin can delete own flight documents" ON public.flight_documents;
CREATE POLICY "Operations and admin can delete own flight documents"
  ON public.flight_documents FOR DELETE
  USING (
    auth.uid() = uploaded_by
    AND (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations') OR public.is_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Operations see quotes on their flights" ON public.quotes;
CREATE POLICY "Operations see quotes on their flights"
  ON public.quotes FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations'))
    AND EXISTS (
      SELECT 1 FROM public.flight_requests fr
      WHERE fr.quotation_id = quotes.id AND public.can_access_flight(fr.id)
    )
  );

-- can_access_lead() gates a lead's team chat and activity notes, but never
-- had an Operations branch at all - Senior Operations (Yousif, the only
-- person with this role) couldn't open a lead's chat/notes on a flight he
-- oversees team-wide but didn't personally accept. Scoped the same way
-- can_access_flight already scopes his flight-level access: any lead with
-- at least one non-draft flight request.
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
        OR (
          public.has_role(auth.uid(), 'senior_operations'::app_role)
          AND EXISTS (
            SELECT 1 FROM public.flight_requests fr
            WHERE fr.lead_id = l.id AND fr.status_sales <> 'draft'
          )
        )
      )
  )
$function$;
