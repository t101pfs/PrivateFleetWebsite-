-- Wire real email delivery to the existing in-app notifications table.
-- Every insert into `notifications` (there are many call sites: flight
-- assignment, chat mentions, breach alerts, document uploads, etc.) now
-- fires an async HTTP call to the `send-notification-email` edge function,
-- which sends the actual email via Resend. Nothing in the app code needs
-- to change - this is a single choke point on the table itself.
--
-- chat_message notifications are deliberately skipped: those fire on every
-- message and would flood inboxes. Everything else emails.
--
-- The webhook secret that authorizes calls to the edge function lives in
-- Supabase Vault, set separately via `vault.create_secret` (not in this
-- file, so it never lands in git).

-- pg_net's schema is fixed at install time (it ships as `net`, not
-- relocatable) - do not add a WITH SCHEMA clause here.
CREATE EXTENSION IF NOT EXISTS pg_net;

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
  IF NEW.type = 'chat_message' THEN
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

DROP TRIGGER IF EXISTS notifications_send_email ON public.notifications;
CREATE TRIGGER notifications_send_email
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_email_on_notification_insert();
