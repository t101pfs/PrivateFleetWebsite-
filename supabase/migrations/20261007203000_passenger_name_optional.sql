-- Sales can now add a passenger by just dropping in a passport/ID photo,
-- with no name typed up front (it's filled in later from the scan, or by
-- Operations editing the row) - full_name can no longer be required at
-- the moment of insert.
ALTER TABLE public.flight_passengers ALTER COLUMN full_name DROP NOT NULL;
