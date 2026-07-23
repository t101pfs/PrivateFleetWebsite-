
-- Fix audit_logs unrestricted insert
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert their own audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

-- Fix flight_status_history insert privilege escalation
DROP POLICY IF EXISTS "Users can insert status history for accessible flights" ON public.flight_status_history;
CREATE POLICY "Ops and admins can insert flight status history"
ON public.flight_status_history FOR INSERT TO authenticated
WITH CHECK (
  public.can_access_flight(flight_id) AND (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'operations'::app_role)
    OR public.has_role(auth.uid(), 'sales'::app_role)
  )
);

-- Fix notifications insert targeting any user
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications for themselves or as privileged role"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'operations'::app_role)
  OR public.has_role(auth.uid(), 'sales'::app_role)
);
