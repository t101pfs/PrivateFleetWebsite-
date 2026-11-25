-- quote_note was shared by both Ops and Sales - whichever side saved last
-- silently overwrote the other's note on the same aircraft option, so only
-- one of the two ever actually made it onto the quotation. Separate field
-- for Sales' own note; both print on the quotation PDF now, stacked.
alter table public.flight_options
  add column if not exists quote_note_sales text;
