-- Client Contract numbering: {sequential}/{service-type code}-{generated-by
-- code}, e.g. 200534/01-002. The sequential part is shared across every
-- contract regardless of language/party type/etc; the service-type and
-- person codes are looked up in the app from a fixed table (see
-- GenerateClientContractDialog.tsx), since those aren't database-backed
-- concepts on their own.
--
-- Starts at 200534 per the existing numbering already in use - the first
-- contract generated under this scheme gets 200534, not 200535.
CREATE SEQUENCE IF NOT EXISTS public.client_contract_number_seq
  START WITH 200534
  INCREMENT BY 1
  NO CYCLE;

-- Sequences aren't directly callable through PostgREST, so this wraps
-- nextval() for any authenticated staff member generating a contract.
-- Advancing the sequence on every dialog open (not just a completed
-- download) is expected and fine - small gaps from an abandoned dialog
-- are normal for this kind of running document number, same as paper
-- invoice books skipping a voided page.
CREATE OR REPLACE FUNCTION public.get_next_client_contract_number()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT nextval('public.client_contract_number_seq');
$function$;

GRANT USAGE ON SEQUENCE public.client_contract_number_seq TO authenticated;
