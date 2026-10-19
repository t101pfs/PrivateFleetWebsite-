-- Same bug as check_deadline_breaches(): this reminder ("client option
-- expires in ~10 minutes") hardcoded the client_confirmation window at 60
-- minutes, so it fired at the wrong time for any flight whose real window
-- is 2 or 12 hours (see resolveClientConfirmMinutes in leadPipeline.ts).
CREATE OR REPLACE FUNCTION public.check_option_expiry_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, flight_id)
  SELECT s.user_id, 'status_update', 'Client Option Expiring',
    'The client option on #' || upper(left(fr.id::text, 8))
      || ' runs out in about 10 minutes — follow up with the client and extend it or confirm.',
    fr.id
  FROM public.flight_requests fr
  CROSS JOIN LATERAL public.flight_sales_user_ids(fr.id) s
  WHERE fr.quotation_issued_at IS NOT NULL
    AND fr.client_confirmed_at IS NULL
    AND now() < public.stage_deadline(
      fr.id, 'client_confirmation', fr.quotation_issued_at,
      CASE
        WHEN fr.departure_date::timestamptz - now() <= interval '3 days' THEN 60
        WHEN fr.departure_date::timestamptz - now() <= interval '14 days' THEN 120
        ELSE 720
      END
    )
    AND now() >= public.stage_deadline(
      fr.id, 'client_confirmation', fr.quotation_issued_at,
      CASE
        WHEN fr.departure_date::timestamptz - now() <= interval '3 days' THEN 60
        WHEN fr.departure_date::timestamptz - now() <= interval '14 days' THEN 120
        ELSE 720
      END
    ) - interval '10 minutes'
    AND fr.option_reminded_for IS DISTINCT FROM public.stage_deadline(
      fr.id, 'client_confirmation', fr.quotation_issued_at,
      CASE
        WHEN fr.departure_date::timestamptz - now() <= interval '3 days' THEN 60
        WHEN fr.departure_date::timestamptz - now() <= interval '14 days' THEN 120
        ELSE 720
      END
    );

  UPDATE public.flight_requests fr
  SET option_reminded_for = public.stage_deadline(
    fr.id, 'client_confirmation', fr.quotation_issued_at,
    CASE
      WHEN fr.departure_date::timestamptz - now() <= interval '3 days' THEN 60
      WHEN fr.departure_date::timestamptz - now() <= interval '14 days' THEN 120
      ELSE 720
    END
  )
  WHERE fr.quotation_issued_at IS NOT NULL
    AND fr.client_confirmed_at IS NULL
    AND now() < public.stage_deadline(
      fr.id, 'client_confirmation', fr.quotation_issued_at,
      CASE
        WHEN fr.departure_date::timestamptz - now() <= interval '3 days' THEN 60
        WHEN fr.departure_date::timestamptz - now() <= interval '14 days' THEN 120
        ELSE 720
      END
    )
    AND now() >= public.stage_deadline(
      fr.id, 'client_confirmation', fr.quotation_issued_at,
      CASE
        WHEN fr.departure_date::timestamptz - now() <= interval '3 days' THEN 60
        WHEN fr.departure_date::timestamptz - now() <= interval '14 days' THEN 120
        ELSE 720
      END
    ) - interval '10 minutes'
    AND fr.option_reminded_for IS DISTINCT FROM public.stage_deadline(
      fr.id, 'client_confirmation', fr.quotation_issued_at,
      CASE
        WHEN fr.departure_date::timestamptz - now() <= interval '3 days' THEN 60
        WHEN fr.departure_date::timestamptz - now() <= interval '14 days' THEN 120
        ELSE 720
      END
    );
END;
$function$;
