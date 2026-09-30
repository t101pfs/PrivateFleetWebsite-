-- Every cost-breakdown field on an option's pricing (Margin, Withholding
-- Tax, Royal Terminal Cost, VAT) can now be entered as either a percentage
-- of operator cost or a flat amount, same as Brokers Commission already
-- allowed (migration 20260927130000). Each existing column keeps meaning
-- exactly what it always did (a percent, or for royal_terminal_cost a flat
-- amount) and gets one new counterpart column plus a _type toggle,
-- defaulted to match the column's pre-existing behavior so no existing
-- option's stored pricing changes meaning.

ALTER TABLE public.flight_options
  ADD COLUMN margin_amount numeric,
  ADD COLUMN margin_type text NOT NULL DEFAULT 'percent'
    CHECK (margin_type IN ('percent', 'flat')),

  ADD COLUMN withholding_tax_amount numeric,
  ADD COLUMN withholding_tax_type text NOT NULL DEFAULT 'percent'
    CHECK (withholding_tax_type IN ('percent', 'flat')),

  ADD COLUMN royal_terminal_percent numeric,
  ADD COLUMN royal_terminal_type text NOT NULL DEFAULT 'flat'
    CHECK (royal_terminal_type IN ('percent', 'flat')),

  ADD COLUMN client_vat_amount numeric,
  ADD COLUMN client_vat_type text NOT NULL DEFAULT 'percent'
    CHECK (client_vat_type IN ('percent', 'flat'));
