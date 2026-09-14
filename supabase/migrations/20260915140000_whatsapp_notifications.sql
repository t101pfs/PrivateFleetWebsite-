-- WhatsApp notifications, same choke-point pattern as email and SMS: a
-- third trigger on `notifications` inserts. Scoped to match email's
-- breadth (everything except chat_message, which is too high-volume) -
-- WhatsApp is cheap and reliably read in this market, so unlike SMS
-- there's no need to restrict it to just breach/overdue alerts.
--
-- Requires the recipient to have a phone_number on file (same column SMS
-- already uses) - anyone without one is silently skipped, no error.

CREATE OR REPLACE FUNCTION public.notify_whatsapp_on_notification_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recipient_phone text;
  webhook_secret text;
BEGIN
  IF NEW.type = 'chat_message' THEN
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
    url := 'https://qipvpijztuqeacfayumd.functions.supabase.co/send-notification-whatsapp',
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

DROP TRIGGER IF EXISTS notifications_send_whatsapp ON public.notifications;
CREATE TRIGGER notifications_send_whatsapp
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_whatsapp_on_notification_insert();
