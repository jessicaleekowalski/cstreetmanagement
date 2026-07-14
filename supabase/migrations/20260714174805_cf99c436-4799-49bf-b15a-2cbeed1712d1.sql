
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_manager() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_owner_entity_ids(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_manages_property(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_owns_property(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_tenant_company_ids(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_tenant_suite_ids(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_can_see_request(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owner_entity_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_manages_property(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_owns_property(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_tenant_company_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_tenant_suite_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_see_request(UUID) TO authenticated;
