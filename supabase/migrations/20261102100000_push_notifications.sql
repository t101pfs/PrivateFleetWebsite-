-- Real phone push notifications (Firebase Cloud Messaging), on top of the
-- existing in-app bell / email / WhatsApp choke-point pattern on the
-- `notifications` table. A device registers its FCM token here once (from
-- the Capacitor app), and every notification insert now also fires a push -
-- including chat_message, which email/WhatsApp deliberately skip: push is
-- what actually reaches someone with the app closed, so a chat ping is the
-- main reason this exists.

CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'android',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS device_push_tokens_user_id_idx ON public.device_push_tokens (user_id);

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own device tokens" ON public.device_push_tokens;
CREATE POLICY "Users manage their own device tokens"
  ON public.device_push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.notify_push_on_notification_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recipient_tokens text[];
  webhook_secret text;
BEGIN
  SELECT array_agg(token) INTO recipient_tokens
  FROM public.device_push_tokens WHERE user_id = NEW.user_id;

  IF recipient_tokens IS NULL OR array_length(recipient_tokens, 1) IS NULL THEN
    RETURN NEW; -- no registered device, nothing to push to
  END IF;

  SELECT decrypted_secret INTO webhook_secret
  FROM vault.decrypted_secrets WHERE name = 'notifications_webhook_secret';
  IF webhook_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://qipvpijztuqeacfayumd.functions.supabase.co/send-notification-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'tokens', to_jsonb(recipient_tokens),
      'title', NEW.title,
      'message', NEW.message,
      'type', NEW.type,
      'flight_id', NEW.flight_id
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notifications_send_push ON public.notifications;
CREATE TRIGGER notifications_send_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_on_notification_insert();
