-- Notification emails/WhatsApp messages told you something needed
-- attention but never linked anywhere - you had to go find the flight
-- yourself in the Request Queue. Both webhook triggers now pass flight_id
-- through so the Edge Functions can build a direct link to it.

CREATE OR REPLACE FUNCTION public.notify_email_on_notification_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recipient_email text;
  webhook_secret text;
BEGIN
  IF NEW.send_email IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT email INTO recipient_email FROM public.profiles WHERE user_id = NEW.user_id;
  IF recipient_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO webhook_secret
  FROM vault.decrypted_secrets WHERE name = 'notifications_webhook_secret';
  IF webhook_secret IS NULL THEN
    RETURN NEW; -- not provisioned yet, skip silently rather than error
  END IF;

  PERFORM net.http_post(
    url := 'https://qipvpijztuqeacfayumd.functions.supabase.co/send-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'to', recipient_email,
      'title', NEW.title,
      'message', NEW.message,
      'type', NEW.type,
      'flight_id', NEW.flight_id
    )
  );

  RETURN NEW;
END;
$function$;

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
      'message', NEW.message,
      'flight_id', NEW.flight_id
    )
  );

  RETURN NEW;
END;
$function$;
