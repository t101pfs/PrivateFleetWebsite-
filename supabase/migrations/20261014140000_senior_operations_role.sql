-- New role: Senior Operations. Everything a regular Operations rep can do,
-- plus team-wide oversight: sees every Ops rep's flights (not just their
-- own accepted work) and can reassign a flight between Ops reps. Modeled
-- on Yousif's actual job description (Senior Charter Operations
-- Coordinator) - requested to apply to him first.
--
-- A Postgres enum value can't be referenced by anything created in the
-- same transaction it's added in, so this is its own migration file -
-- the RLS/function changes that use it follow in a separate one.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'senior_operations';
