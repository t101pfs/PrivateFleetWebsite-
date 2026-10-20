-- Qusai's phone_number had a stray space ("+966 564664994") and Twilio
-- silently rejected every WhatsApp send to him (error 21211) - the trigger
-- passed whatever was in the column straight through with no normalization.
-- Strips whitespace before sending so a stray space/dash entered into a
-- profile doesn't quietly break delivery for that person again, for either
-- WhatsApp or SMS (same profiles.phone_number column, same risk).

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

  SELECT regexp_replace(phone_number, '\s+', '', 'g') INTO recipient_phone
  FROM public.profiles WHERE user_id = NEW.user_id;
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

  SELECT regexp_replace(phone_number, '\s+', '', 'g') INTO recipient_phone
  FROM public.profiles WHERE user_id = NEW.user_id;
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
