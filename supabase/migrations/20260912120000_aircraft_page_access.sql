-- The Aircraft & Operators page was previously unreachable from any nav
-- menu and ran on hardcoded fake data. Now that it's real and linked in
-- the Ops/Admin sidebar, bring it into the same Page Access control
-- Admins already have for every other real page.
INSERT INTO public.page_access (page_key, label, path, enabled)
VALUES ('aircraft', 'Aircraft & Operators', '/aircraft', true)
ON CONFLICT (page_key) DO NOTHING;
