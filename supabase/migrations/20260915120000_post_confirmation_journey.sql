-- Post-confirmation journey: VIP flag on passengers, a public (no-login)
-- catering request form clients fill out themselves, and structured data
-- for the Flight Briefing document.

-- ===== 1. VIP passengers =====
ALTER TABLE public.flight_passengers
  ADD COLUMN is_vip boolean NOT NULL DEFAULT false;

-- ===== 2. Catering requests (public-submittable) =====
CREATE TABLE public.catering_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id uuid NOT NULL REFERENCES public.flight_requests(id) ON DELETE CASCADE,
  passenger_id uuid REFERENCES public.flight_passengers(id) ON DELETE SET NULL,
  diner_name text NOT NULL,
  cuisine text,
  course text,
  custom_request text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_requests_has_selection CHECK (
    custom_request IS NOT NULL OR (cuisine IS NOT NULL AND course IS NOT NULL)
  )
);

ALTER TABLE public.catering_requests ENABLE ROW LEVEL SECURITY;

-- Staff can see/manage requests for flights they can already access - same
-- boundary used everywhere else (flight_documents, flight_passengers, etc).
CREATE POLICY "Staff can manage catering requests for their flights"
  ON public.catering_requests FOR ALL
  USING (public.can_access_flight(flight_id))
  WITH CHECK (public.can_access_flight(flight_id));

-- The client submitting this has no PFS login at all - this is the one
-- deliberately public write in the schema. Scoped to just requiring a
-- real flight_id (not a free-for-all insert anywhere) and nothing else;
-- there is no public SELECT policy, so a submitter can't read back other
-- passengers' requests, only add their own.
CREATE POLICY "Anyone can submit a catering request for a real flight"
  ON public.catering_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.flight_requests fr WHERE fr.id = flight_id));

-- Public-safe flight summary for the catering page header (route + date
-- only) - never expose flight_requests directly to anon, it holds client
-- contract/cost/commission data no unauthenticated link should reach.
CREATE OR REPLACE FUNCTION public.get_catering_flight_summary(_flight_id uuid)
RETURNS TABLE(route_from text, route_to text, departure_date date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT fr.route_from, fr.route_to, fr.departure_date
  FROM public.flight_requests fr
  WHERE fr.id = _flight_id
$$;

-- Public-safe passenger picker for the catering page - name only, never
-- passport/DOB data, which lives in the same table.
CREATE OR REPLACE FUNCTION public.get_catering_passenger_names(_flight_id uuid)
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT fp.id, fp.full_name
  FROM public.flight_passengers fp
  WHERE fp.flight_id = _flight_id
  ORDER BY fp.full_name
$$;

GRANT EXECUTE ON FUNCTION public.get_catering_flight_summary(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_catering_passenger_names(uuid) TO anon, authenticated;

-- ===== 3. Flight Briefing operational data =====
-- One row per flight - the fields the real Flight Briefing template needs
-- that nothing in the system tracks yet (departure/arrival time, handling
-- agents, terminal details, permit status). Ops fills this in once
-- confirmed; the briefing PDF pulls route/date/pax/aircraft from the
-- existing flight + selected option automatically.
CREATE TABLE public.flight_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id uuid NOT NULL UNIQUE REFERENCES public.flight_requests(id) ON DELETE CASCADE,
  briefing_number text,
  departure_time text,
  arrival_time text,
  flight_duration text,
  handling_agents text,
  terminals_dep_airport text,
  terminals_dep_location text,
  terminals_arr_airport text,
  terminals_arr_location text,
  slots_permits jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_flight_briefings_updated_at
  BEFORE UPDATE ON public.flight_briefings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.flight_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage flight briefings for their flights"
  ON public.flight_briefings FOR ALL
  USING (public.can_access_flight(flight_id))
  WITH CHECK (public.can_access_flight(flight_id));
