-- New pricing build for each aircraft option: Ops enters the operator's net
-- charter price and says whether VAT is already included in it - if not,
-- the system tops it up by 15% before anything else uses it as "the
-- operator cost" (base_price, unchanged meaning for every existing reader).
--
-- From that normalized operator cost, Ops (or Admin) builds the client
-- price by adding: Margin %, Withholding Tax %, a flat Royal Terminal
-- Cost, Brokers Commission %, then the client-facing VAT % on top of all
-- of that. The result is saved into price_override, the column that
-- already existed for "the price the client sees, as opposed to base_price".
--
-- operator_cost_net keeps what Ops actually typed (before any VAT top-up)
-- so re-opening the option to edit shows the real original number instead
-- of the grossed-up one.

ALTER TABLE public.flight_options
  ADD COLUMN operator_cost_net numeric,
  ADD COLUMN operator_cost_vat_included boolean NOT NULL DEFAULT true,
  ADD COLUMN margin_percent numeric,
  ADD COLUMN withholding_tax_percent numeric,
  ADD COLUMN royal_terminal_cost numeric,
  ADD COLUMN brokers_commission_percent numeric,
  ADD COLUMN client_vat_percent numeric;
