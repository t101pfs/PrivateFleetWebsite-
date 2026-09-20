-- Voice notes in the lead Team Chat. A voice note is an ordinary message row
-- (content holds a short text label so previews still read sensibly) plus a
-- pointer to the recording in a private bucket. Recordings are filed under
-- the lead's id, and only people who can access that lead can read or add
-- them - the same rule as the chat messages themselves.

ALTER TABLE public.messages
  ADD COLUMN audio_path text,
  ADD COLUMN audio_duration_seconds integer;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-voice-notes', 'chat-voice-notes', false, 10485760)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Lead team can read chat voice notes"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-voice-notes'
    AND public.can_access_lead(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Lead team can upload chat voice notes"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-voice-notes'
    AND public.can_access_lead(((storage.foldername(name))[1])::uuid)
  );

-- Lets someone remove a recording they uploaded if the message insert that
-- follows it fails.
CREATE POLICY "Uploader can delete own chat voice note"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-voice-notes' AND owner = auth.uid());
