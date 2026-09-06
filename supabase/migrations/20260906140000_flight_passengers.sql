-- Per-passenger passport/ID and catering tracking, confirmed as a real
-- requirement rather than something handled outside the system. One row
-- per traveler on a flight, not just a single shared note.

CREATE TABLE public.flight_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id uuid NOT NULL REFERENCES public.flight_requests(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  passport_number text,
  nationality text,
  passport_expiry date,
  date_of_birth date,
  catering_notes text,
  passport_scan_path text,
  passport_scan_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_flight_passengers_updated_at
  BEFORE UPDATE ON public.flight_passengers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.flight_passengers ENABLE ROW LEVEL SECURITY;

-- Same access boundary as everything else on a flight — whoever can see
-- the flight itself (creator, lead owner, lead team member, or Operations
-- once it's posted) can view and manage its passenger list.
CREATE POLICY "Staff can manage flight passengers" ON public.flight_passengers
FOR ALL
USING (public.can_access_flight(flight_id))
WITH CHECK (public.can_access_flight(flight_id));

-- Passport scans reuse the existing private flight-documents bucket, under
-- {flight_id}/passengers/{passenger_id}/... — same storage policies already
-- grant Sales/Operations/Admin access to that whole bucket.
