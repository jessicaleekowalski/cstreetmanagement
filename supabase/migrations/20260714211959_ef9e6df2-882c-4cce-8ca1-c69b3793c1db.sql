CREATE POLICY "Update files for visible requests"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'request-files'
  AND private.user_can_see_request(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'request-files'
  AND private.user_can_see_request(((storage.foldername(name))[1])::uuid)
);