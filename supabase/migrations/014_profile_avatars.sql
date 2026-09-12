-- Profile photos (avatars)
--
-- `profiles.avatar_url` already exists from migration 001. This adds the
-- storage bucket policies and mirrors the avatar onto the HR-facing candidate
-- directory row so employer surfaces can render it without an extra join.
--
-- Additive and idempotent. No destructive SQL.

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

UPDATE candidates c
SET avatar_url = p.avatar_url
FROM profiles p
WHERE p.id = c.id AND c.avatar_url IS NULL AND p.avatar_url IS NOT NULL;

-- Public bucket: avatars are shown to approved employers and SEH staff, and a
-- candidate's photo is only ever published once they choose to be discoverable.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Each user owns a folder named after their user id.
DROP POLICY IF EXISTS avatars_read ON storage.objects;
CREATE POLICY avatars_read ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_write_own ON storage.objects;
CREATE POLICY avatars_write_own ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
CREATE POLICY avatars_update_own ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;
CREATE POLICY avatars_delete_own ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- profiles_update_own (migration 001) already permits a user to write their own
-- row, which is what setting avatar_url needs.
