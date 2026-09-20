-- Catering is now one request for the whole flight (not one per passenger) and
-- is chosen by searching a menu rather than picking a cuisine first. A request
-- can therefore have dishes without a cuisine, or just a drink/appetizer/
-- dessert, so the "must have a cuisine + dish" rule is relaxed to "must ask for
-- something". Existing rows all satisfy the new rule.

ALTER TABLE public.catering_requests
  DROP CONSTRAINT catering_requests_has_selection;

ALTER TABLE public.catering_requests
  ADD CONSTRAINT catering_requests_has_selection CHECK (
    custom_request IS NOT NULL
    OR course IS NOT NULL
    OR appetizer IS NOT NULL
    OR drink IS NOT NULL
    OR dessert IS NOT NULL
  );
