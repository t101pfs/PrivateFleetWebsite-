-- Lead 360's own "Mark as Lost" button set status='lost' with no reason
-- captured at all, unlike the more complete flight-level Mark as Lost flow
-- (used only on the old Flights.tsx drawer) which requires one. Bringing
-- the same requirement to the actual page people use now.

ALTER TABLE public.leads
  ADD COLUMN lost_reason text;
