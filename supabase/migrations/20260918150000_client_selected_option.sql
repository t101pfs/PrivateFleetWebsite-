-- Sales can now shortlist and quote MORE THAN ONE aircraft to the client at
-- once, but nothing recorded which one the client actually picked once they
-- replied — every downstream view just grabbed "the first selected option",
-- and FlightBriefingPanel's `.eq('is_selected', true).maybeSingle()` query
-- outright errors when more than one option is still marked selected.
-- This column is the real record of the client's final choice, set when
-- Sales confirms with the client (PostQuotationWorkflow Stage 1).
ALTER TABLE public.flight_requests
  ADD COLUMN client_selected_option_id uuid REFERENCES public.flight_options(id);
