-- Handling agents used to be one free-text field for the whole briefing,
-- which got unreadable for multi-leg flights (everything crammed into one
-- line). This adds a per-leg array alongside it so each leg can carry its
-- own handling agent text; the old column stays for briefings already
-- filled in under the old single-field style.
ALTER TABLE public.flight_briefings
  ADD COLUMN IF NOT EXISTS handling_agents_legs jsonb NOT NULL DEFAULT '[]'::jsonb;
