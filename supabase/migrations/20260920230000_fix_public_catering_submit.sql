-- The public catering link never actually worked: the insert rule checked that
-- the flight exists by reading flight_requests, but the visitor is anonymous
-- and can't read that table, so the check always failed ("new row violates
-- row-level security policy") and no request could ever be saved. Do the
-- existence check in a function that runs with its own access instead. It only
-- answers yes/no for a flight id; it exposes nothing about the flight.

CREATE OR REPLACE FUNCTION public.flight_exists_for_catering(_flight_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.flight_requests fr
    WHERE fr.id = _flight_id AND fr.status_sales <> 'cancelled'
  )
$$;

REVOKE ALL ON FUNCTION public.flight_exists_for_catering(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flight_exists_for_catering(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can submit a catering request for a real flight" ON public.catering_requests;
CREATE POLICY "Anyone can submit a catering request for a real flight"
  ON public.catering_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.flight_exists_for_catering(flight_id));
