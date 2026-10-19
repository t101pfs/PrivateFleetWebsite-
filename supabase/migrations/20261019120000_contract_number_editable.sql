-- The contract number was always auto-assigned and read-only, which meant
-- any correction (a redo that needs to reuse a number, a typo, skipping a
-- gap on purpose) had to go through a manual sequence reset. Two pieces to
-- make it editable in the UI instead:
--
-- 1. A non-consuming "peek" at what the next number would be, so the field
--    can show a sensible suggestion without burning a real sequence value
--    just by opening the dialog (same concern as the generate-time fix).
CREATE OR REPLACE FUNCTION public.peek_next_client_contract_number()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END
  FROM public.client_contract_number_seq;
$function$;

GRANT EXECUTE ON FUNCTION public.peek_next_client_contract_number() TO authenticated;

-- 2. After a contract is actually generated with whatever number ended up
--    in the field (the suggestion, or something the user typed instead),
--    this keeps the sequence from falling behind so the next suggestion
--    doesn't repeat a number just used - but only ever moves it forward.
--    Typing an OLDER number on purpose (e.g. redoing a contract under its
--    original number) must not drag future suggestions backward.
CREATE OR REPLACE FUNCTION public.sync_client_contract_number_floor(_used bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_value bigint;
BEGIN
  SELECT last_value INTO current_value FROM public.client_contract_number_seq;
  IF _used > current_value THEN
    PERFORM setval('public.client_contract_number_seq', _used, true);
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sync_client_contract_number_floor(bigint) TO authenticated;
