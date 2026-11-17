-- flight_feedback's three policies check has_role(..., 'operations') by
-- exact match, same as every other table before the senior_operations role
-- existed (see 20261024090000_senior_operations_can_source.sql for the same
-- gap on flight_options/aircraft). Senior Operations could already reach
-- every flight via can_access_flight(), but still couldn't read, submit or
-- edit operator feedback on any of them - and critically, this silently
-- broke the Team Performance report for Yousif's own session: his query for
-- flight_feedback came back empty under RLS, so the Operator Feedback
-- column would show nothing for anyone, not just him.

DROP POLICY IF EXISTS "Read own side of flight feedback" ON public.flight_feedback;
CREATE POLICY "Read own side of flight feedback"
  ON public.flight_feedback FOR SELECT TO authenticated
  USING (
    public.can_access_flight(flight_id)
    AND (
      public.is_admin(auth.uid())
      OR (kind = 'operator' AND (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations')))
      OR (kind = 'client' AND public.has_role(auth.uid(), 'sales'))
    )
  );

DROP POLICY IF EXISTS "Submit own side of flight feedback" ON public.flight_feedback;
CREATE POLICY "Submit own side of flight feedback"
  ON public.flight_feedback FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND public.can_access_flight(flight_id)
    AND (
      public.is_admin(auth.uid())
      OR (kind = 'operator' AND (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations')))
      OR (kind = 'client' AND public.has_role(auth.uid(), 'sales'))
    )
  );

DROP POLICY IF EXISTS "Edit own side of flight feedback" ON public.flight_feedback;
CREATE POLICY "Edit own side of flight feedback"
  ON public.flight_feedback FOR UPDATE TO authenticated
  USING (
    public.can_access_flight(flight_id)
    AND (
      public.is_admin(auth.uid())
      OR (kind = 'operator' AND (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations')))
      OR (kind = 'client' AND public.has_role(auth.uid(), 'sales'))
    )
  )
  WITH CHECK (
    public.can_access_flight(flight_id)
    AND (
      public.is_admin(auth.uid())
      OR (kind = 'operator' AND (public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'senior_operations')))
      OR (kind = 'client' AND public.has_role(auth.uid(), 'sales'))
    )
  );
