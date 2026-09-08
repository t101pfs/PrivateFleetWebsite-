-- The Clients page was rebuilt into a two-part Accounts page (Active
-- Clients + Potential Clients). Keep the Page Access label in sync.
UPDATE public.page_access SET label = 'Accounts' WHERE page_key = 'clients';
