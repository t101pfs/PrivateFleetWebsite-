-- Documents like the Client Contract can be generated in either English or
-- Arabic; the signer's job title needs to read naturally in whichever one
-- was picked, not just carry over the English title untranslated. A second
-- column lets each person's profile hold both.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title_ar text;
