
-- estimates
DROP POLICY IF EXISTS "Managers write estimates" ON public.estimates;
CREATE POLICY "Managers write estimates" ON public.estimates
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.is_manager() AND (EXISTS (SELECT 1 FROM maintenance_requests r WHERE r.id = estimates.request_id AND (private.is_admin() OR private.user_manages_property(r.property_id)))))
  WITH CHECK (private.is_manager() AND (EXISTS (SELECT 1 FROM maintenance_requests r WHERE r.id = estimates.request_id AND (private.is_admin() OR private.user_manages_property(r.property_id)))));

-- financial_impact_notes
DROP POLICY IF EXISTS "Managers write financial notes" ON public.financial_impact_notes;
CREATE POLICY "Managers write financial notes" ON public.financial_impact_notes
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.is_manager() AND (EXISTS (SELECT 1 FROM maintenance_requests r WHERE r.id = financial_impact_notes.request_id AND (private.is_admin() OR private.user_manages_property(r.property_id)))))
  WITH CHECK (private.is_manager() AND (EXISTS (SELECT 1 FROM maintenance_requests r WHERE r.id = financial_impact_notes.request_id AND (private.is_admin() OR private.user_manages_property(r.property_id)))));

-- tenant_suite_assignments
DROP POLICY IF EXISTS "Managers write tsa" ON public.tenant_suite_assignments;
CREATE POLICY "Managers write tsa" ON public.tenant_suite_assignments
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.is_manager() AND (EXISTS (SELECT 1 FROM suites s WHERE s.id = tenant_suite_assignments.suite_id AND (private.is_admin() OR private.user_manages_property(s.property_id)))))
  WITH CHECK (private.is_manager() AND (EXISTS (SELECT 1 FROM suites s WHERE s.id = tenant_suite_assignments.suite_id AND (private.is_admin() OR private.user_manages_property(s.property_id)))));

-- work_completion_records: need original expression
DROP POLICY IF EXISTS "Managers write completion records" ON public.work_completion_records;
CREATE POLICY "Managers write completion records" ON public.work_completion_records
  AS PERMISSIVE FOR ALL TO authenticated
  USING (private.is_manager() AND (EXISTS (SELECT 1 FROM maintenance_requests r WHERE r.id = work_completion_records.request_id AND (private.is_admin() OR private.user_manages_property(r.property_id)))))
  WITH CHECK (private.is_manager() AND (EXISTS (SELECT 1 FROM maintenance_requests r WHERE r.id = work_completion_records.request_id AND (private.is_admin() OR private.user_manages_property(r.property_id)))));

-- storage.objects: Managers delete files
DROP POLICY IF EXISTS "Managers delete files" ON storage.objects;
CREATE POLICY "Managers delete files" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (bucket_id = 'request-files' AND private.is_manager() AND private.user_can_see_request(((storage.foldername(name))[1])::uuid));

-- profiles: insert own row
CREATE POLICY "Users insert own profile" ON public.profiles
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
