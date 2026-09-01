-- Confirmed requirement: more than one Sales rep can work the same lead
-- (not just its assigned owner or whoever happened to create the flight
-- request). flight_requests/flight_options previously only granted Sales
-- access via fr.created_by = auth.uid(), which is narrower than the
-- can_access_flight() helper already used for per-flight chat (which also
-- allows the lead's assigned owner) — and neither one accounted for
-- lead_team_members at all. Extend can_access_flight() to include team
-- membership, and switch flight_requests/flight_options' Sales policies to
-- use it so ownership, lead assignment, and team membership are all
-- honored consistently everywhere access is checked.

CREATE OR REPLACE FUNCTION public.can_access_flight(_flight_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
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
        OR (public.has_role(auth.uid(), 'sales'::app_role) AND EXISTS (
              SELECT 1 FROM public.lead_team_members ltm
              WHERE ltm.lead_id = fr.lead_id AND ltm.user_id = auth.uid()
            ))
        OR (public.has_role(auth.uid(), 'operations'::app_role) AND fr.status_sales <> 'draft')
      )
  )
$function$;

DROP POLICY IF EXISTS "Sales can view own flights" ON public.flight_requests;
CREATE POLICY "Sales can view own flights" ON public.flight_requests
FOR SELECT
USING (public.has_role(auth.uid(), 'sales'::app_role) AND public.can_access_flight(id));

DROP POLICY IF EXISTS "Sales can update own flights" ON public.flight_requests;
CREATE POLICY "Sales can update own flights" ON public.flight_requests
FOR UPDATE
USING (public.has_role(auth.uid(), 'sales'::app_role) AND public.can_access_flight(id));

DROP POLICY IF EXISTS "Sales can view flight options" ON public.flight_options;
CREATE POLICY "Sales can view flight options" ON public.flight_options
FOR SELECT
USING (public.has_role(auth.uid(), 'sales'::app_role) AND public.can_access_flight(flight_id));

DROP POLICY IF EXISTS "Sales can select options" ON public.flight_options;
CREATE POLICY "Sales can select options" ON public.flight_options
FOR UPDATE
USING (public.has_role(auth.uid(), 'sales'::app_role) AND public.can_access_flight(flight_id));
