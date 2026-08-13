-- Flight-scoped sourcing activity log for the Operations "Sourcing Workspace"
-- page (e.g. "Operator A contacted", "Team chat update"). Distinct from
-- lead_activities, which is lead-scoped, not flight-scoped.
CREATE TABLE public.flight_sourcing_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id uuid NOT NULL REFERENCES public.flight_requests(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flight_sourcing_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accessible to whoever can access the flight" ON public.flight_sourcing_activities
  FOR SELECT USING (public.can_access_flight(flight_id));

CREATE POLICY "Operations/admin can log sourcing activity" ON public.flight_sourcing_activities
  FOR INSERT WITH CHECK (
    public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'operations'::app_role)
  );
