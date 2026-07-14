
-- Create a private schema for internal SECURITY DEFINER helpers so they are not exposed via the API
CREATE SCHEMA IF NOT EXISTS private;

-- Allow roles to traverse the schema so RLS policies (which reference these functions by OID) still resolve.
GRANT USAGE ON SCHEMA private TO postgres, service_role, authenticated, anon;

-- Move each flagged SECURITY DEFINER helper to the private schema.
-- Policies and triggers reference functions by OID, so moving schemas does not require rewriting them.
ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.is_admin() SET SCHEMA private;
ALTER FUNCTION public.is_manager() SET SCHEMA private;
ALTER FUNCTION public.current_org_id() SET SCHEMA private;
ALTER FUNCTION public.user_owner_entity_ids(uuid) SET SCHEMA private;
ALTER FUNCTION public.user_tenant_company_ids(uuid) SET SCHEMA private;
ALTER FUNCTION public.user_tenant_suite_ids(uuid) SET SCHEMA private;
ALTER FUNCTION public.user_manages_property(uuid) SET SCHEMA private;
ALTER FUNCTION public.user_owns_property(uuid) SET SCHEMA private;
ALTER FUNCTION public.user_can_see_request(uuid) SET SCHEMA private;
ALTER FUNCTION public.handle_new_user() SET SCHEMA private;
ALTER FUNCTION public.set_updated_at() SET SCHEMA private;

-- Tighten EXECUTE: revoke from PUBLIC/anon; keep authenticated so RLS policy evaluation can still call them,
-- and keep service_role for admin paths.
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_manager() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_org_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.user_owner_entity_ids(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.user_tenant_company_ids(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.user_tenant_suite_ids(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.user_manages_property(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.user_owns_property(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.user_can_see_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.set_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_manager() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_org_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_owner_entity_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_tenant_company_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_tenant_suite_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_manages_property(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_owns_property(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_can_see_request(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION private.set_updated_at() TO service_role;

-- Update search_path on functions so their bodies (which reference public.* tables) still resolve.
ALTER FUNCTION private.has_role(uuid, public.app_role) SET search_path = public;
ALTER FUNCTION private.is_admin() SET search_path = public, private;
ALTER FUNCTION private.is_manager() SET search_path = public, private;
ALTER FUNCTION private.current_org_id() SET search_path = public;
ALTER FUNCTION private.user_owner_entity_ids(uuid) SET search_path = public;
ALTER FUNCTION private.user_tenant_company_ids(uuid) SET search_path = public;
ALTER FUNCTION private.user_tenant_suite_ids(uuid) SET search_path = public;
ALTER FUNCTION private.user_manages_property(uuid) SET search_path = public, private;
ALTER FUNCTION private.user_owns_property(uuid) SET search_path = public;
ALTER FUNCTION private.user_can_see_request(uuid) SET search_path = public, private;
ALTER FUNCTION private.handle_new_user() SET search_path = public;
ALTER FUNCTION private.set_updated_at() SET search_path = public;

-- is_admin/is_manager/user_manages_property/user_can_see_request call other helpers by unqualified name; recreate their bodies with schema-qualified refs to be safe.
CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT private.has_role(auth.uid(), 'admin'::public.app_role) $$;

CREATE OR REPLACE FUNCTION private.is_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT private.has_role(auth.uid(), 'property_manager'::public.app_role) OR private.has_role(auth.uid(), 'admin'::public.app_role) $$;

CREATE OR REPLACE FUNCTION private.user_manages_property(_property_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT private.is_admin() OR EXISTS (
    SELECT 1 FROM public.property_manager_assignments
    WHERE property_id = _property_id AND manager_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION private.user_can_see_request(_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.maintenance_requests r
    WHERE r.id = _request_id AND (
      private.is_admin()
      OR private.user_manages_property(r.property_id)
      OR private.user_owns_property(r.property_id)
      OR r.tenant_company_id IN (SELECT private.user_tenant_company_ids(auth.uid()))
    )
  );
$$;
