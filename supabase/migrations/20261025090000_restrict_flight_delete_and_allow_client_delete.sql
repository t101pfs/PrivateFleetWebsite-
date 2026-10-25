-- Danah: any admin should be able to delete a client account, but deleting
-- a whole flight (which cascades away its options, quotes, documents,
-- passengers, feedback and history) should stay limited to Noora and Odai
-- specifically, not every admin.

-- Clients already had FOR ALL admin access (20260803162819), so no RLS
-- change was needed there - only the UI was missing a delete action.

-- flight_requests previously granted admins FOR ALL (including DELETE) in
-- one policy. Splitting it so DELETE is its own, narrower policy.
DROP POLICY IF EXISTS "Admin full access to flights" ON public.flight_requests;

CREATE POLICY "Admin can view all flights" ON public.flight_requests
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can create flights" ON public.flight_requests
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update flights" ON public.flight_requests
  FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "Noora and Odai can delete flights" ON public.flight_requests
  FOR DELETE USING (
    public.is_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.email IN ('noora@privatefleetservices.com', 'odai@privatefleetservices.com')
    )
  );
