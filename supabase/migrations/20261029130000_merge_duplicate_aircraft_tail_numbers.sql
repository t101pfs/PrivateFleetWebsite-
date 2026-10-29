-- Tail numbers were being saved exactly as typed, so the same physical
-- aircraft could end up as two rows that only differ by case or stray
-- spaces (e.g. "HZ-ABC" vs "hz-abc "), which the aircraft-reuse picker on
-- "Add Aircraft Option" would then show as two separate planes. The app
-- now normalizes (trims + uppercases) tail numbers before saving; this
-- merges any duplicates that already exist, repointing every table that
-- references the one being removed, then locks in case/whitespace-
-- insensitive uniqueness at the database level so this can't recur.

CREATE TEMP TABLE aircraft_dup_map AS
WITH ranked AS (
  SELECT
    id,
    upper(btrim(tail_number)) AS norm_tail,
    row_number() OVER (
      PARTITION BY upper(btrim(tail_number))
      ORDER BY
        (images IS NOT NULL AND array_length(images, 1) > 0) DESC,
        (category IS NOT NULL) DESC,
        created_at ASC,
        id ASC
    ) AS rn
  FROM public.aircraft
),
canonical AS (
  SELECT norm_tail, id AS canonical_id FROM ranked WHERE rn = 1
)
SELECT r.id AS dup_id, c.canonical_id
FROM ranked r
JOIN canonical c ON c.norm_tail = r.norm_tail
WHERE r.rn > 1;

UPDATE public.flight_requests fr
SET aircraft_id = dm.canonical_id
FROM aircraft_dup_map dm
WHERE fr.aircraft_id = dm.dup_id;

UPDATE public.quotes q
SET aircraft_id = dm.canonical_id
FROM aircraft_dup_map dm
WHERE q.aircraft_id = dm.dup_id;

UPDATE public.flight_metrics fm
SET aircraft_id = dm.canonical_id
FROM aircraft_dup_map dm
WHERE fm.aircraft_id = dm.dup_id;

UPDATE public.maintenance_windows mw
SET aircraft_id = dm.canonical_id
FROM aircraft_dup_map dm
WHERE mw.aircraft_id = dm.dup_id;

DELETE FROM public.aircraft a
USING aircraft_dup_map dm
WHERE a.id = dm.dup_id;

DROP TABLE aircraft_dup_map;

-- Normalize whatever's left so every row matches the format the app now saves.
UPDATE public.aircraft
SET tail_number = upper(btrim(tail_number))
WHERE tail_number <> upper(btrim(tail_number));

-- Belt-and-braces: enforce this at the database level too, so a future
-- app-side bug can't quietly recreate the same duplicate-plane problem.
CREATE UNIQUE INDEX IF NOT EXISTS aircraft_tail_number_normalized_idx
  ON public.aircraft (upper(btrim(tail_number)));
