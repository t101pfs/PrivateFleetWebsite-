-- Senior Operations: everything a regular Operations rep can do, plus
-- team-wide oversight (sees every flight, not just their own accepted
-- work) and the ability to reassign a flight between Ops reps.

-- can_access_flight() gates nearly every flight-related table (storage
-- docs, flight_documents, quotes, flight_options, messages, flight
-- history, sourcing activity, passengers, catering, briefings, feedback,
-- follow-ups) - extending it here is what gives Senior Operations full
-- visibility across all of those in one place, not just flight_requests
-- itself.
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
        OR (
          public.has_role(auth.uid(), 'senior_operations'::app_role)
          AND fr.status_sales <> 'draft'
        )
      )
  )
$function$;

-- flight_requests' own SELECT/UPDATE policies check roles inline rather
-- than through can_access_flight(), so they need their own Senior
-- Operations entries - full read, and write access broad enough to
-- actually reassign (unlike regular Operations, who can only set
-- assigned_ops_id to themselves or back to null).
CREATE POLICY "Senior Operations see every flight"
  ON public.flight_requests
  FOR SELECT
  USING (public.has_role(auth.uid(), 'senior_operations'::app_role) AND status_sales <> 'draft');

CREATE POLICY "Senior Operations manage every flight and reassign"
  ON public.flight_requests
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'senior_operations'::app_role) AND status_sales <> 'draft')
  WITH CHECK (public.has_role(auth.uid(), 'senior_operations'::app_role) AND status_sales <> 'draft');

-- Broadcast-to-all-Operations notifications (new flight posted, Ops
-- escalation fallbacks) should reach Senior Operations too - they're
-- still frontline Operations staff, just with more visibility on top.
CREATE OR REPLACE FUNCTION public.get_operations_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role IN ('operations'::app_role, 'senior_operations'::app_role);
$function$;
