-- Admins (Odai, Noora - anyone with 'admin' or 'super_admin') are meant to
-- have oversight across every flight, but they were only ever added to a
-- lead's team chat when someone manually dragged that lead to "Qualified"
-- on the Pipeline Board (ensureLeadTeamChat in leadTeamChat.ts) - a path
-- most leads never actually go through, since the real flow is submit ->
-- straight to the Ops pool. This adds them at the moment a lead is
-- created instead, regardless of which of the app's several lead-insert
-- call sites creates it.
CREATE OR REPLACE FUNCTION public.add_admins_to_new_lead_team()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.lead_team_members (lead_id, user_id, role_label)
  SELECT NEW.id, a.user_id, 'Management'
  FROM public.get_admin_user_ids() a
  ON CONFLICT (lead_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS add_admins_to_new_lead_team ON public.leads;
CREATE TRIGGER add_admins_to_new_lead_team
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.add_admins_to_new_lead_team();

-- One-time backfill for leads that already existed before this trigger.
INSERT INTO public.lead_team_members (lead_id, user_id, role_label)
SELECT l.id, a.user_id, 'Management'
FROM public.leads l
CROSS JOIN public.get_admin_user_ids() a
ON CONFLICT (lead_id, user_id) DO NOTHING;
