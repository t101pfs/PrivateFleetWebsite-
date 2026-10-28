-- Missing the 10-minute Ops accept window used to remove the flight from
-- Operations entirely (RLS excluded it the moment status_ops flipped to
-- 'escalated' / ops_lockout_at got set) - Admin got notified, but a regular
-- Ops person lost all access, even to just look at it. Per Danah: keep the
-- timer and the overdue flag/notification, but let Operations still accept
-- it themselves - just beyond the target time.

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
            OR (fr.assigned_ops_id IS NULL AND fr.status_ops IN ('new', 'escalated'))
          )
        )
        OR (
          public.has_role(auth.uid(), 'senior_operations'::app_role)
          AND fr.status_sales <> 'draft'
        )
      )
  )
$function$;

DROP POLICY IF EXISTS "Operations see their flights and the queue" ON public.flight_requests;
CREATE POLICY "Operations see their flights and the queue"
  ON public.flight_requests FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'operations')
    AND status_sales <> 'draft'
    AND (
      assigned_ops_id = auth.uid()
      OR (assigned_ops_id IS NULL AND status_ops IN ('new', 'escalated'))
    )
  );

DROP POLICY IF EXISTS "Operations update their flights and accept from the queue" ON public.flight_requests;
CREATE POLICY "Operations update their flights and accept from the queue"
  ON public.flight_requests FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'operations')
    AND status_sales <> 'draft'
    AND (
      assigned_ops_id = auth.uid()
      OR (assigned_ops_id IS NULL AND status_ops IN ('new', 'escalated'))
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'operations')
    AND status_sales <> 'draft'
    AND (assigned_ops_id = auth.uid() OR assigned_ops_id IS NULL)
  );
