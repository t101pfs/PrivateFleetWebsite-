-- Noora needs to be able to hand a flight off to a different Ops rep (the
-- "Reassign Ops" button on the sourcing workspace), same as an Admin or
-- Senior Operations already can. The button was only shown to her if she
-- were literally an Admin - this is the matching database-level grant,
-- checked by her email rather than role so it doesn't depend on whatever
-- single role her account actually holds (same reasoning as the existing
-- "Noora and Odai can delete flights" policy).
CREATE POLICY "Noora can reassign ops" ON public.flight_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.email = 'noora@privatefleetservices.com'
    )
  );

-- Reassigning also notifies the old and new Ops owner - without this she
-- could move the flight but the "you've been reassigned" pings would
-- silently fail to send (and the whole action would show as failed, since
-- the dialog treats that insert failing as the reassignment itself failing).
DROP POLICY IF EXISTS "Users can insert notifications for themselves or as privileged role" ON public.notifications;
CREATE POLICY "Users can insert notifications for themselves or as privileged role"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'operations'::app_role)
  OR public.has_role(auth.uid(), 'sales'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.email = 'noora@privatefleetservices.com'
  )
);
