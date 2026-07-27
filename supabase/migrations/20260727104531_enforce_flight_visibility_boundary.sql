-- Makes the sales/ops information boundary a real server-side guarantee
-- instead of a frontend convention.
--
-- Postgres RLS is row-level only: it controls which ROWS a role can read,
-- not which COLUMNS. flight_requests and flight_options each store both
-- sides' sensitive fields on the same row (client identity alongside
-- aircraft/operator identity), and the frontend was fetching the full row
-- with `select('*')` and then nulling out fields in JavaScript after the
-- fact (see useFlightRequests.ts / useFlightOptions.ts) -- a convention
-- that is trivially bypassed by reading the raw API response.
--
-- Fix: rename each table to a `_base` table, put RLS + all existing
-- triggers/indexes on that (they follow the renamed object automatically),
-- then recreate the original name as a security_invoker view that masks
-- exactly the fields the app already treats as hidden -- nothing more, so
-- fields sales/ops legitimately use (pricing, commission, base_price)
-- stay untouched. INSTEAD OF triggers forward writes through to the base
-- table unchanged, so every existing insert/update/delete callsite keeps
-- working without modification.

-- =====================================================================
-- flight_requests
-- =====================================================================

ALTER TABLE public.flight_requests RENAME TO flight_requests_base;

-- Internal functions/policies that queried flight_requests directly need
-- to keep pointing at the real table, not the new masking view.
CREATE OR REPLACE FUNCTION public.can_access_flight(_flight_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.flight_requests_base fr
    WHERE fr.id = _flight_id
      AND (
        public.is_admin(auth.uid())
        OR (public.has_role(auth.uid(), 'sales'::app_role) AND fr.created_by = auth.uid())
        OR (public.has_role(auth.uid(), 'operations'::app_role) AND fr.status_sales <> 'draft')
      )
  )
$$;

DROP POLICY IF EXISTS "Sales can view flight options" ON public.flight_options;
CREATE POLICY "Sales can view flight options"
ON public.flight_options
FOR SELECT
USING (
  has_role(auth.uid(), 'sales'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.flight_requests_base fr
    WHERE fr.id = flight_options.flight_id
    AND fr.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Sales can select options" ON public.flight_options;
CREATE POLICY "Sales can select options"
ON public.flight_options
FOR UPDATE
USING (
  has_role(auth.uid(), 'sales'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.flight_requests_base fr
    WHERE fr.id = flight_options.flight_id
    AND fr.created_by = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'sales'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.flight_requests_base fr
    WHERE fr.id = flight_options.flight_id
    AND fr.created_by = auth.uid()
  )
);

-- Masking view: matches exactly what useFlightRequests.ts already tried
-- to enforce client-side -- client identity hidden from operations;
-- operator identity always hidden from sales; aircraft identity hidden
-- from sales until the flight is confirmed/completed.
CREATE VIEW public.flight_requests
WITH (security_invoker = true)
AS
SELECT
  fr.id,
  fr.created_at,
  fr.updated_at,
  CASE WHEN public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sales'::app_role)
       THEN fr.client_id END AS client_id,
  CASE WHEN public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'sales'::app_role)
       THEN fr.client_name END AS client_name,
  fr.route_from,
  fr.route_to,
  fr.departure_date,
  fr.departure_time,
  fr.passengers,
  fr.special_requests,
  fr.status_sales,
  fr.status_ops,
  fr.created_by,
  fr.assigned_ops_id,
  fr.assigned_ops_name,
  CASE WHEN public.is_admin(auth.uid())
         OR public.has_role(auth.uid(), 'operations'::app_role)
         OR (public.has_role(auth.uid(), 'sales'::app_role) AND fr.status_sales IN ('confirmed', 'completed'))
       THEN fr.aircraft_id END AS aircraft_id,
  CASE WHEN public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'operations'::app_role)
       THEN fr.operator_id END AS operator_id,
  fr.commission_percent,
  fr.pricing_breakdown,
  fr.flight_type,
  fr.flight_legs,
  fr.is_urgent,
  fr.lead_id,
  fr.lost_reason,
  fr.options_status,
  fr.quotation_id,
  fr.cancellation_reason
FROM public.flight_requests_base fr;

CREATE OR REPLACE FUNCTION public.flight_requests_view_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_id uuid;
  ret_row public.flight_requests%ROWTYPE;
BEGIN
  INSERT INTO public.flight_requests_base (
    id, client_id, client_name, route_from, route_to, departure_date, departure_time,
    passengers, special_requests, status_sales, status_ops, created_by,
    assigned_ops_id, assigned_ops_name, aircraft_id, operator_id,
    commission_percent, pricing_breakdown, flight_type, flight_legs,
    is_urgent, lead_id, lost_reason, options_status, quotation_id, cancellation_reason
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()), NEW.client_id, NEW.client_name, NEW.route_from, NEW.route_to,
    NEW.departure_date, NEW.departure_time, COALESCE(NEW.passengers, 1), NEW.special_requests,
    COALESCE(NEW.status_sales, 'draft'), COALESCE(NEW.status_ops, 'new'), NEW.created_by,
    NEW.assigned_ops_id, NEW.assigned_ops_name, NEW.aircraft_id, NEW.operator_id,
    NEW.commission_percent, NEW.pricing_breakdown, NEW.flight_type, NEW.flight_legs,
    NEW.is_urgent, NEW.lead_id, NEW.lost_reason, NEW.options_status, NEW.quotation_id, NEW.cancellation_reason
  )
  RETURNING id INTO new_id;

  SELECT * INTO ret_row FROM public.flight_requests WHERE id = new_id;
  RETURN ret_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.flight_requests_view_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  ret_row public.flight_requests%ROWTYPE;
BEGIN
  -- Only write columns that actually changed in this request. NEW/OLD
  -- both reflect the *masked* view for the current caller, so a column
  -- the caller can't see is always NEW = OLD (both NULL) here and is
  -- correctly left untouched, instead of being overwritten with NULL.
  UPDATE public.flight_requests_base SET
    client_id            = CASE WHEN NEW.client_id           IS DISTINCT FROM OLD.client_id           THEN NEW.client_id           ELSE client_id           END,
    client_name          = CASE WHEN NEW.client_name         IS DISTINCT FROM OLD.client_name         THEN NEW.client_name         ELSE client_name         END,
    route_from           = CASE WHEN NEW.route_from          IS DISTINCT FROM OLD.route_from          THEN NEW.route_from          ELSE route_from          END,
    route_to             = CASE WHEN NEW.route_to            IS DISTINCT FROM OLD.route_to            THEN NEW.route_to            ELSE route_to            END,
    departure_date       = CASE WHEN NEW.departure_date      IS DISTINCT FROM OLD.departure_date      THEN NEW.departure_date      ELSE departure_date      END,
    departure_time       = CASE WHEN NEW.departure_time      IS DISTINCT FROM OLD.departure_time      THEN NEW.departure_time      ELSE departure_time      END,
    passengers           = CASE WHEN NEW.passengers          IS DISTINCT FROM OLD.passengers          THEN NEW.passengers          ELSE passengers          END,
    special_requests     = CASE WHEN NEW.special_requests    IS DISTINCT FROM OLD.special_requests    THEN NEW.special_requests    ELSE special_requests    END,
    status_sales         = CASE WHEN NEW.status_sales        IS DISTINCT FROM OLD.status_sales        THEN NEW.status_sales        ELSE status_sales        END,
    status_ops           = CASE WHEN NEW.status_ops          IS DISTINCT FROM OLD.status_ops          THEN NEW.status_ops          ELSE status_ops          END,
    assigned_ops_id      = CASE WHEN NEW.assigned_ops_id     IS DISTINCT FROM OLD.assigned_ops_id     THEN NEW.assigned_ops_id     ELSE assigned_ops_id     END,
    assigned_ops_name    = CASE WHEN NEW.assigned_ops_name   IS DISTINCT FROM OLD.assigned_ops_name   THEN NEW.assigned_ops_name   ELSE assigned_ops_name   END,
    aircraft_id          = CASE WHEN NEW.aircraft_id         IS DISTINCT FROM OLD.aircraft_id         THEN NEW.aircraft_id         ELSE aircraft_id         END,
    operator_id          = CASE WHEN NEW.operator_id         IS DISTINCT FROM OLD.operator_id         THEN NEW.operator_id         ELSE operator_id         END,
    commission_percent   = CASE WHEN NEW.commission_percent  IS DISTINCT FROM OLD.commission_percent  THEN NEW.commission_percent  ELSE commission_percent  END,
    pricing_breakdown    = CASE WHEN NEW.pricing_breakdown   IS DISTINCT FROM OLD.pricing_breakdown   THEN NEW.pricing_breakdown   ELSE pricing_breakdown   END,
    flight_type          = CASE WHEN NEW.flight_type         IS DISTINCT FROM OLD.flight_type         THEN NEW.flight_type         ELSE flight_type         END,
    flight_legs          = CASE WHEN NEW.flight_legs         IS DISTINCT FROM OLD.flight_legs         THEN NEW.flight_legs         ELSE flight_legs         END,
    is_urgent            = CASE WHEN NEW.is_urgent           IS DISTINCT FROM OLD.is_urgent           THEN NEW.is_urgent           ELSE is_urgent           END,
    lead_id              = CASE WHEN NEW.lead_id             IS DISTINCT FROM OLD.lead_id             THEN NEW.lead_id             ELSE lead_id             END,
    lost_reason          = CASE WHEN NEW.lost_reason         IS DISTINCT FROM OLD.lost_reason         THEN NEW.lost_reason         ELSE lost_reason         END,
    options_status       = CASE WHEN NEW.options_status      IS DISTINCT FROM OLD.options_status      THEN NEW.options_status      ELSE options_status      END,
    quotation_id         = CASE WHEN NEW.quotation_id        IS DISTINCT FROM OLD.quotation_id        THEN NEW.quotation_id        ELSE quotation_id        END,
    cancellation_reason  = CASE WHEN NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN NEW.cancellation_reason ELSE cancellation_reason END
  WHERE id = OLD.id;

  SELECT * INTO ret_row FROM public.flight_requests WHERE id = OLD.id;
  RETURN ret_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.flight_requests_view_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.flight_requests_base WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER flight_requests_view_insert
INSTEAD OF INSERT ON public.flight_requests
FOR EACH ROW EXECUTE FUNCTION public.flight_requests_view_insert();

CREATE TRIGGER flight_requests_view_update
INSTEAD OF UPDATE ON public.flight_requests
FOR EACH ROW EXECUTE FUNCTION public.flight_requests_view_update();

CREATE TRIGGER flight_requests_view_delete
INSTEAD OF DELETE ON public.flight_requests
FOR EACH ROW EXECUTE FUNCTION public.flight_requests_view_delete();

-- =====================================================================
-- flight_options
-- =====================================================================

ALTER TABLE public.flight_options RENAME TO flight_options_base;

CREATE VIEW public.flight_options
WITH (security_invoker = true)
AS
SELECT
  fo.id,
  fo.flight_id,
  fo.aircraft_type,
  fo.aircraft_specs,
  fo.available_times,
  fo.estimated_duration,
  fo.base_price,
  fo.aircraft_images,
  CASE WHEN public.is_admin(auth.uid())
         OR public.has_role(auth.uid(), 'operations'::app_role)
       THEN fo.operator_id END AS operator_id,
  fo.is_selected,
  fo.created_by,
  fo.created_at,
  fo.updated_at,
  fo.aircraft_registration,
  fo.baggage_capacity,
  fo.currency,
  fo.availability_status,
  fo.interior_images,
  fo.layout_image,
  fo.aircraft_notes,
  fo.aircraft_features,
  fo.is_draft,
  fo.commission_percent,
  fo.vat_on_commission,
  fo.price_override
FROM public.flight_options_base fo;

CREATE OR REPLACE FUNCTION public.flight_options_view_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  new_id uuid;
  ret_row public.flight_options%ROWTYPE;
BEGIN
  INSERT INTO public.flight_options_base (
    id, flight_id, aircraft_type, aircraft_specs, available_times, estimated_duration,
    base_price, aircraft_images, operator_id, is_selected, created_by,
    aircraft_registration, baggage_capacity, currency, availability_status,
    interior_images, layout_image, aircraft_notes, aircraft_features, is_draft,
    commission_percent, vat_on_commission, price_override
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()), NEW.flight_id, NEW.aircraft_type, NEW.aircraft_specs,
    NEW.available_times, NEW.estimated_duration, NEW.base_price, NEW.aircraft_images,
    NEW.operator_id, COALESCE(NEW.is_selected, false), NEW.created_by,
    NEW.aircraft_registration, NEW.baggage_capacity, NEW.currency, NEW.availability_status,
    NEW.interior_images, NEW.layout_image, NEW.aircraft_notes, NEW.aircraft_features,
    NEW.is_draft, NEW.commission_percent, COALESCE(NEW.vat_on_commission, false), NEW.price_override
  )
  RETURNING id INTO new_id;

  SELECT * INTO ret_row FROM public.flight_options WHERE id = new_id;
  RETURN ret_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.flight_options_view_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  ret_row public.flight_options%ROWTYPE;
BEGIN
  UPDATE public.flight_options_base SET
    aircraft_type        = CASE WHEN NEW.aircraft_type        IS DISTINCT FROM OLD.aircraft_type        THEN NEW.aircraft_type        ELSE aircraft_type        END,
    aircraft_specs       = CASE WHEN NEW.aircraft_specs       IS DISTINCT FROM OLD.aircraft_specs       THEN NEW.aircraft_specs       ELSE aircraft_specs       END,
    available_times      = CASE WHEN NEW.available_times      IS DISTINCT FROM OLD.available_times      THEN NEW.available_times      ELSE available_times      END,
    estimated_duration   = CASE WHEN NEW.estimated_duration   IS DISTINCT FROM OLD.estimated_duration   THEN NEW.estimated_duration   ELSE estimated_duration   END,
    base_price           = CASE WHEN NEW.base_price           IS DISTINCT FROM OLD.base_price           THEN NEW.base_price           ELSE base_price           END,
    aircraft_images      = CASE WHEN NEW.aircraft_images       IS DISTINCT FROM OLD.aircraft_images      THEN NEW.aircraft_images      ELSE aircraft_images      END,
    operator_id          = CASE WHEN NEW.operator_id          IS DISTINCT FROM OLD.operator_id          THEN NEW.operator_id          ELSE operator_id          END,
    is_selected          = CASE WHEN NEW.is_selected          IS DISTINCT FROM OLD.is_selected          THEN NEW.is_selected          ELSE is_selected          END,
    aircraft_registration = CASE WHEN NEW.aircraft_registration IS DISTINCT FROM OLD.aircraft_registration THEN NEW.aircraft_registration ELSE aircraft_registration END,
    baggage_capacity     = CASE WHEN NEW.baggage_capacity     IS DISTINCT FROM OLD.baggage_capacity     THEN NEW.baggage_capacity     ELSE baggage_capacity     END,
    currency             = CASE WHEN NEW.currency             IS DISTINCT FROM OLD.currency             THEN NEW.currency             ELSE currency             END,
    availability_status  = CASE WHEN NEW.availability_status  IS DISTINCT FROM OLD.availability_status  THEN NEW.availability_status  ELSE availability_status  END,
    interior_images      = CASE WHEN NEW.interior_images      IS DISTINCT FROM OLD.interior_images      THEN NEW.interior_images      ELSE interior_images      END,
    layout_image         = CASE WHEN NEW.layout_image         IS DISTINCT FROM OLD.layout_image         THEN NEW.layout_image         ELSE layout_image         END,
    aircraft_notes       = CASE WHEN NEW.aircraft_notes       IS DISTINCT FROM OLD.aircraft_notes       THEN NEW.aircraft_notes       ELSE aircraft_notes       END,
    aircraft_features    = CASE WHEN NEW.aircraft_features    IS DISTINCT FROM OLD.aircraft_features    THEN NEW.aircraft_features    ELSE aircraft_features    END,
    is_draft             = CASE WHEN NEW.is_draft             IS DISTINCT FROM OLD.is_draft             THEN NEW.is_draft             ELSE is_draft             END,
    commission_percent   = CASE WHEN NEW.commission_percent   IS DISTINCT FROM OLD.commission_percent   THEN NEW.commission_percent   ELSE commission_percent   END,
    vat_on_commission    = CASE WHEN NEW.vat_on_commission    IS DISTINCT FROM OLD.vat_on_commission    THEN NEW.vat_on_commission    ELSE vat_on_commission    END,
    price_override       = CASE WHEN NEW.price_override       IS DISTINCT FROM OLD.price_override       THEN NEW.price_override       ELSE price_override       END
  WHERE id = OLD.id;

  SELECT * INTO ret_row FROM public.flight_options WHERE id = OLD.id;
  RETURN ret_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.flight_options_view_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.flight_options_base WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER flight_options_view_insert
INSTEAD OF INSERT ON public.flight_options
FOR EACH ROW EXECUTE FUNCTION public.flight_options_view_insert();

CREATE TRIGGER flight_options_view_update
INSTEAD OF UPDATE ON public.flight_options
FOR EACH ROW EXECUTE FUNCTION public.flight_options_view_update();

CREATE TRIGGER flight_options_view_delete
INSTEAD OF DELETE ON public.flight_options
FOR EACH ROW EXECUTE FUNCTION public.flight_options_view_delete();
