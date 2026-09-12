-- Candidate document storage hardening.
--
-- Private bucket: candidates receive signed URLs for their own uploaded
-- documents. Each user can only write/delete inside their own user-id folder.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'candidate-documents',
  'candidate-documents',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS candidate_documents_read_own ON storage.objects;
CREATE POLICY candidate_documents_read_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'candidate-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS candidate_documents_insert_own ON storage.objects;
CREATE POLICY candidate_documents_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'candidate-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS candidate_documents_update_own ON storage.objects;
CREATE POLICY candidate_documents_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'candidate-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'candidate-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS candidate_documents_delete_own ON storage.objects;
CREATE POLICY candidate_documents_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'candidate-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
