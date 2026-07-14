
-- Storage layout: request-files/<request_id>/<uuid>-<filename>
CREATE POLICY "Read files for visible requests"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'request-files'
  AND public.user_can_see_request(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Upload files for visible requests"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'request-files'
  AND public.user_can_see_request(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Managers delete files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'request-files'
  AND public.is_manager()
);
