-- The public catering form (PublicCateringForm.tsx) writes straight into
-- catering_requests with no app-code notification step at all - it can't
-- safely insert into notifications for other users itself, since the
-- client submitting it is anonymous. Nobody was ever told the client had
-- responded; staff only found out by happening to check the flight. This
-- notifies the assigned Ops rep (who prepares catering) and everyone on
-- the Sales side of the flight (who cares the client replied), the same
-- way every other stage of the flight already notifies people.
CREATE OR REPLACE FUNCTION public.notify_catering_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  fr public.flight_requests%ROWTYPE;
  ref text;
  diner_label text;
BEGIN
  SELECT * INTO fr FROM public.flight_requests WHERE id = NEW.flight_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  ref := '#' || upper(left(fr.id::text, 8));
  diner_label := CASE WHEN NEW.diner_name = 'Whole flight' THEN 'the whole flight' ELSE NEW.diner_name END;

  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT DISTINCT target.user_id, 'status_update', 'Catering Preferences Received',
    'The client submitted catering preferences for ' || diner_label || ' on ' || ref
      || ' (' || fr.route_from || ' → ' || fr.route_to || ').',
    fr.id
  FROM (
    SELECT fr.assigned_ops_id AS user_id WHERE fr.assigned_ops_id IS NOT NULL
    UNION
    SELECT s.user_id FROM public.flight_sales_user_ids(fr.id) s
  ) target;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER catering_request_notify
AFTER INSERT ON public.catering_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_catering_submitted();
