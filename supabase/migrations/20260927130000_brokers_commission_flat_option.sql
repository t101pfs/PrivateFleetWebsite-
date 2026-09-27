-- Brokers Commission can now be set as a flat cost instead of only a
-- percentage of the operator cost.
ALTER TABLE public.flight_options
  ADD COLUMN brokers_commission_amount numeric,
  ADD COLUMN brokers_commission_type text NOT NULL DEFAULT 'percent'
    CHECK (brokers_commission_type IN ('percent', 'flat'));
