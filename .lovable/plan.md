# Charter Workflow & Luxury Quotation PDF — Implementation Plan

This is a large multi-part build. I'll break it into 3 phases that map to your STEPS 1–3, while leveraging what already exists.

## What's already in place
- `flight_requests` table with dual status (`status_sales` / `status_ops`), `options_status`, `commission_percent`
- `flight_options` table (aircraft_type, specs JSONB, base_price, images, operator_id, is_selected)
- `FlightOptionsTab`, `AddFlightOptionDialog`, `EditFlightOptionDialog`, `FlightOptionCard`
- `aircraft-images` storage bucket (public)
- `quotes` table (basic pricing fields, quote_number auto-gen)
- Role system (sales / operations / admin / super_admin) with strict commercial confidentiality (Ops never see pricing/commission)
- `audit_logs`, `flight_status_history` for tracking

## Phase 1 — STEP 1: Expand Operations aircraft offers

**DB migration** — extend `flight_options.aircraft_specs` JSONB to standardize new fields (no schema change needed, but I'll document the shape) and add 3 real columns for first-class fields:
- `aircraft_registration TEXT`
- `baggage_capacity TEXT`
- `currency TEXT DEFAULT 'USD'`
- `availability_status TEXT DEFAULT 'available'` (available / on_request / unavailable)
- `interior_images TEXT[]` (separate from main `aircraft_images`)
- `layout_image TEXT` (single floorplan)
- `aircraft_notes TEXT`
- `aircraft_features TEXT[]`
- `is_draft BOOLEAN DEFAULT true` (so Ops can save drafts before publishing to Sales)

**UI changes** to `AddFlightOptionDialog` + `EditFlightOptionDialog`:
- Add all new fields
- Image uploaders: 1 main image, multiple interior images, 1 layout image (uses existing `aircraft-images` bucket)
- "Save as Draft" vs "Publish to Sales" buttons
- New "Mark request ready for Sales" action button on the tab that flips `options_status` → `options_prepared` and notifies Sales

## Phase 2 — STEP 2: Sales pricing builder

**DB migration** — add to `flight_requests`:
- `pricing_breakdown JSONB` storing `{ markup_percent, markup_amount, vat_percent (default 15), vat_amount, taxes, additional_charges, discount, final_total, currency }`

**New component** `PricingBuilder.tsx` inside `FlightOptionsTab` (Sales-only, replaces the simple commission box):
- Shows selected aircraft offers with their base prices
- Inputs: markup %, discount, taxes, additional charges, VAT toggle (15% default)
- Live preview of: Base → +Markup → +VAT → +Taxes → +Add'l → −Discount → **Final Total**
- "Save Pricing" persists `pricing_breakdown`
- "Generate Quotation PDF" button (Phase 3)

## Phase 3 — STEP 3: Luxury client-facing PDF

**Library**: `@react-pdf/renderer` (works in-browser, no edge function needed, supports RTL via Arabic-capable fonts like Noto Sans Arabic).

**New files**:
- `src/lib/quotation-pdf.tsx` — React-PDF document component
- `src/components/quotations/QuotationPreview.tsx` — preview dialog with Download button
- `src/components/quotations/QuotationGenerator.tsx` — bridges flight + selected options + pricing → PDF

**PDF structure** (A4, repeating header/footer, auto page numbers):
1. Cover with PFS logo + branding (Dark Navy / Bright Blue), quotation # & date
2. Company info block (address EN + AR, phone 920003455, email, website)
3. Client info card
4. Flight details — supports one-way / round-trip / multi-leg (iterates `flight_legs` JSONB), each leg with date, route, ICAO codes, times, duration, pax
5. Aircraft offers — one premium brochure card per selected option (A1, A2…) with main image, interior gallery, layout image, features, notes, capacity, price
6. Pricing breakdown table with highlighted **Final Total**
7. Terms & Conditions (stored in `system_settings` so admin can edit — I'll seed defaults)
8. Acceptance block with signature field + statement
9. Optional QR code (links to a future verification URL — placeholder for now)

**Branding**: PFS logo (`pf-logo.png`), Dark Navy `#0a1f3d`, Bright Blue accent, serif display + clean sans body for executive feel.

**Versioning**: each generated PDF creates a `quotes` row (reusing existing table) linked to the flight via `flight_requests.quotation_id`, giving you version history.

## What I'd defer (call out explicitly)
- **Arabic full RTL** — I'll wire the font + layout direction, but the PDF body content will be EN by default with bilingual address. Full bilingual quotation toggle can come in a follow-up.
- **QR code verification page** — I'll embed the QR pointing at `/q/{quote_id}` but the public verification page is a separate task.
- **Watermark** — I'll add a subtle "DRAFT" watermark when `quotes.status='draft'`; remove on issued.
- **Audit trail for pricing edits** — I'll log to existing `audit_logs` table on each pricing save.

## Suggested execution order
1. Phase 1 migration + UI (Operations gets new fields, drafts, publish action)
2. Phase 2 migration + Sales pricing builder
3. Phase 3 install `@react-pdf/renderer`, build PDF + preview + generation flow

---

**Confirm to proceed**, or tell me to:
- Start with just Phase 1, then check in
- Skip/change anything above
- Adjust branding colors or PDF style direction
