-- Restructure leads table to support the Leads Pipeline board:
-- deal value, service type, a free-text deal summary, priority, and a
-- next-action date, plus a status vocabulary that matches the 5 pipeline
-- stages (New/Qualified/Pricing/Quoted/Negotiation) with Won/Lost/Converted
-- as terminal states that drop off the board.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS estimated_value NUMERIC,
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS deal_summary TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS next_action_date DATE;

-- Remap existing status values to the new pipeline vocabulary
UPDATE public.leads SET status = 'qualified' WHERE status = 'contacted';
UPDATE public.leads SET status = 'quoted' WHERE status = 'proposal';
UPDATE public.leads SET status = 'new' WHERE status IS NULL;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_status_check
  CHECK (status IN ('new', 'qualified', 'pricing', 'quoted', 'negotiation', 'won', 'lost', 'converted'));
ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'new';

CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);
