
-- 1. Estimates: enforce property scope on WITH CHECK
DROP POLICY IF EXISTS "Managers write estimates" ON public.estimates;
CREATE POLICY "Managers write estimates" ON public.estimates
  FOR ALL
  USING (
    is_manager() AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r
      WHERE r.id = estimates.request_id
        AND (is_admin() OR user_manages_property(r.property_id))
    )
  )
  WITH CHECK (
    is_manager() AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r
      WHERE r.id = estimates.request_id
        AND (is_admin() OR user_manages_property(r.property_id))
    )
  );

-- 2. Financial impact notes: enforce property scope
DROP POLICY IF EXISTS "Managers write financial notes" ON public.financial_impact_notes;
CREATE POLICY "Managers write financial notes" ON public.financial_impact_notes
  FOR ALL
  USING (
    is_manager() AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r
      WHERE r.id = financial_impact_notes.request_id
        AND (is_admin() OR user_manages_property(r.property_id))
    )
  )
  WITH CHECK (
    is_manager() AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r
      WHERE r.id = financial_impact_notes.request_id
        AND (is_admin() OR user_manages_property(r.property_id))
    )
  );

-- 3. Tenant-suite assignments: enforce property/org scope
DROP POLICY IF EXISTS "Managers write tsa" ON public.tenant_suite_assignments;
CREATE POLICY "Managers write tsa" ON public.tenant_suite_assignments
  FOR ALL
  USING (
    is_manager() AND EXISTS (
      SELECT 1 FROM public.suites s
      WHERE s.id = tenant_suite_assignments.suite_id
        AND (is_admin() OR user_manages_property(s.property_id))
    )
  )
  WITH CHECK (
    is_manager() AND EXISTS (
      SELECT 1 FROM public.suites s
      WHERE s.id = tenant_suite_assignments.suite_id
        AND (is_admin() OR user_manages_property(s.property_id))
    )
  );

-- 4. Work completion records: enforce property scope
DROP POLICY IF EXISTS "Managers write completion records" ON public.work_completion_records;
CREATE POLICY "Managers write completion records" ON public.work_completion_records
  FOR ALL
  USING (
    is_manager() AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r
      WHERE r.id = work_completion_records.request_id
        AND (is_admin() OR user_manages_property(r.property_id))
    )
  )
  WITH CHECK (
    is_manager() AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r
      WHERE r.id = work_completion_records.request_id
        AND (is_admin() OR user_manages_property(r.property_id))
    )
  );

-- 5. Storage delete policy: require manager to be authorized for the specific request
DROP POLICY IF EXISTS "Managers delete files" ON storage.objects;
CREATE POLICY "Managers delete files" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'request-files'
    AND is_manager()
    AND user_can_see_request(((storage.foldername(name))[1])::uuid)
  );

-- 6. handle_new_user: revoke EXECUTE from signed-in users; it only needs to run as the auth trigger owner
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
