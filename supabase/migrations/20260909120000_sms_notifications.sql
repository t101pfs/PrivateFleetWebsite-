-- Phone/SMS notifications, on the same choke-point pattern as email
-- (migration 20260908120000): a trigger on `notifications` inserts.
--
-- Unlike email, SMS only fires for genuinely time-sensitive breach alerts
-- (the four titles the auto-breach-alert job in
-- 20260907120000_auto_breach_alerts.sql uses) - texting someone on every
-- notification (chat messages, routine status updates, etc.) would be
-- excessive and costly. Also requires the recipient to have a phone
-- number on file, which most users won't yet - this ships safely and
-- simply does nothing for anyone without one.

ALTER TABLE public.profiles
  ADD COLUMN phone_number text;

CREATE OR REPLACE FUNCTION public.notify_sms_on_notification_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recipient_phone text;
  webhook_secret text;
BEGIN
  IF NEW.title NOT IN (
    'Operations Timeline Breached',
    'Client Confirmation Overdue',
    'Operator Contract Overdue',
    'Client Contract Overdue'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT phone_number INTO recipient_phone FROM public.profiles WHERE user_id = NEW.user_id;
  IF recipient_phone IS NULL OR recipient_phone = '' THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO webhook_secret
  FROM vault.decrypted_secrets WHERE name = 'notifications_webhook_secret';
  IF webhook_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://qipvpijztuqeacfayumd.functions.supabase.co/send-notification-sms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'to', recipient_phone,
      'title', NEW.title,
      'message', NEW.message
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notifications_send_sms ON public.notifications;
CREATE TRIGGER notifications_send_sms
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_sms_on_notification_insert();
