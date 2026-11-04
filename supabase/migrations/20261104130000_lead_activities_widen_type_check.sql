-- The original CHECK only allowed ('note', 'stage_change', 'quotation_sent',
-- 'assigned', 'won', 'lost', 'converted') - but the app has been inserting
-- 'owner_changed', 'team_member_added' and 'team_member_removed' for a while
-- too (presumably this constraint was already loosened by hand at some point
-- and this migration just wasn't backfilled - this makes sure it's correct
-- regardless). Adds 'flight_updated' for the new general flight-edit log
-- entry (LeadForm.tsx) on top.
ALTER TABLE public.lead_activities DROP CONSTRAINT IF EXISTS lead_activities_activity_type_check;

ALTER TABLE public.lead_activities ADD CONSTRAINT lead_activities_activity_type_check
  CHECK (activity_type IN (
    'note', 'stage_change', 'quotation_sent', 'assigned', 'won', 'lost', 'converted',
    'owner_changed', 'team_member_added', 'team_member_removed', 'flight_updated'
  ));
