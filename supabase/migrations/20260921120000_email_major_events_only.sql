-- Email is now reserved for the two major moments: a new flight request
-- being posted (the first request) and a flight being confirmed. Every
-- other step notification stays in the app and goes out over the
-- phone-number (WhatsApp) channel, which is unchanged.
--
-- A notification is emailed only when its row says so (send_email). The
-- call sites that create the two major notifications set it; everything
-- else - including anything added later - defaults to no email.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS send_email boolean NOT NULL DEFAULT false;

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
      'type', NEW.type
    )
  );

  RETURN NEW;
END;
$function$;
