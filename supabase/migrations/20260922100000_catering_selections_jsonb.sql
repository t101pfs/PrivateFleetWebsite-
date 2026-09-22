-- The catering menu grew from 4 generic sections (appetizer/course/dessert/
-- drink) to the real VIP menu's 15 courses (Breakfast, Soup, Appetizers,
-- Salads, Chicken, Beef, Lamb, Veal, Seafood, Pasta, Rice, Potatoes,
-- Vegetables, Dessert, Hot Snacks). The old fixed columns can't hold that
-- shape, so requests now carry a `selections` jsonb array of
-- { section: <course label>, items: [<dish>, ...] }, one entry per course
-- the diner picked from. The old columns stay - existing rows still read
-- through them - but are no longer written to.

ALTER TABLE public.catering_requests
  ADD COLUMN IF NOT EXISTS selections jsonb;

ALTER TABLE public.catering_requests
  DROP CONSTRAINT catering_requests_has_selection;

ALTER TABLE public.catering_requests
  ADD CONSTRAINT catering_requests_has_selection CHECK (
    custom_request IS NOT NULL
    OR course IS NOT NULL
    OR appetizer IS NOT NULL
    OR drink IS NOT NULL
    OR dessert IS NOT NULL
    OR (selections IS NOT NULL AND jsonb_array_length(selections) > 0)
  );
