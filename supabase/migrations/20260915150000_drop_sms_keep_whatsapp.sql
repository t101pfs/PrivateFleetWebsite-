-- User decided against SMS entirely - WhatsApp only for real-time phone
-- notifications, alongside email. SMS was built (migration 20260909120000)
-- but never actually activated (TWILIO_FROM_NUMBER was never set), so
-- this is a clean removal, not a behavior change for anyone.
DROP TRIGGER IF EXISTS notifications_send_sms ON public.notifications;
DROP FUNCTION IF EXISTS public.notify_sms_on_notification_insert();
