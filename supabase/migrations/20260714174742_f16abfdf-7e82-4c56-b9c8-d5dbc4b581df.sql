
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'property_manager', 'owner', 'tenant');
CREATE TYPE public.urgency_level AS ENUM ('routine', 'soon', 'urgent', 'emergency');
CREATE TYPE public.responsibility_type AS ENUM ('owner', 'tenant', 'shared', 'warranty', 'unknown');
CREATE TYPE public.request_status AS ENUM (
  'submitted','manager_review','awaiting_information','estimating',
  'awaiting_owner_approval','owner_question','additional_estimate_requested',
  'approved','declined','vendor_coordination','scheduled','in_progress',
  'work_completed','invoice_pending','completed','closed','cancelled'
);
CREATE TYPE public.comment_visibility AS ENUM ('internal_manager','manager_owner','manager_tenant','all_parties');
CREATE TYPE public.attachment_type AS ENUM ('initial_photo','estimate','invoice','completion_photo','warranty','other');
CREATE TYPE public.impact_category AS ENUM (
  'current_operating_budget','cash_flow','future_operating_expense','capital_expenditure',
  'preventive_maintenance','lease_term_consideration','tenant_responsibility',
  'insurance_or_warranty','compliance_or_safety','revenue_or_tenant_retention_risk','other'
);
CREATE TYPE public.impact_timeframe AS ENUM ('immediate','current_month','current_quarter','current_year','next_budget_year','long_term');
CREATE TYPE public.approval_decision AS ENUM ('pending','approved','declined','additional_estimate_requested','question');

-- ============================================================
-- SHARED TRIGGER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_org_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_profiles_org ON public.profiles(organization_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- USER ROLES (separate table per security rules)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- ============================================================
-- SECURITY DEFINER HELPERS (avoid RLS recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'property_manager') OR public.has_role(auth.uid(), 'admin');
$$;

-- user_roles policies (after helper exists)
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- organizations policies
CREATE POLICY "Members read own org" ON public.organizations FOR SELECT TO authenticated
  USING (id = public.current_org_id());
CREATE POLICY "Admins update own org" ON public.organizations FOR UPDATE TO authenticated
  USING (id = public.current_org_id() AND public.is_admin());

-- profiles policies
CREATE POLICY "Users see own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (organization_id = public.current_org_id() AND public.is_manager()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Admins manage profiles in org" ON public.profiles FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_admin())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_admin());

-- ============================================================
-- OWNER ENTITIES
-- ============================================================
CREATE TABLE public.owner_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_entities TO authenticated;
GRANT ALL ON public.owner_entities TO service_role;
ALTER TABLE public.owner_entities ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_owner_entities_org ON public.owner_entities(organization_id);
CREATE TRIGGER trg_oe_updated BEFORE UPDATE ON public.owner_entities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.owner_entity_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_entity_id UUID NOT NULL REFERENCES public.owner_entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_entity_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_entity_users TO authenticated;
GRANT ALL ON public.owner_entity_users TO service_role;
ALTER TABLE public.owner_entity_users ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_oeu_user ON public.owner_entity_users(user_id);

CREATE OR REPLACE FUNCTION public.user_owner_entity_ids(_user_id UUID)
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT owner_entity_id FROM public.owner_entity_users WHERE user_id = _user_id;
$$;

CREATE POLICY "Manager reads owner_entities in org" ON public.owner_entities FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_manager());
CREATE POLICY "Owner reads own owner_entity" ON public.owner_entities FOR SELECT TO authenticated
  USING (id IN (SELECT public.user_owner_entity_ids(auth.uid())));
CREATE POLICY "Manager writes owner_entities" ON public.owner_entities FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_manager());

CREATE POLICY "See own owner_entity_users" ON public.owner_entity_users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_manager());
CREATE POLICY "Admin writes owner_entity_users" ON public.owner_entity_users FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- PROPERTIES
-- ============================================================
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_entity_id UUID NOT NULL REFERENCES public.owner_entities(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  property_type TEXT,
  year_built INT,
  square_feet INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_properties_org ON public.properties(organization_id);
CREATE INDEX idx_properties_owner ON public.properties(owner_entity_id);
CREATE TRIGGER trg_prop_updated BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.property_manager_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  manager_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, manager_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_manager_assignments TO authenticated;
GRANT ALL ON public.property_manager_assignments TO service_role;
ALTER TABLE public.property_manager_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pma_manager ON public.property_manager_assignments(manager_user_id);

CREATE OR REPLACE FUNCTION public.user_manages_property(_property_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.property_manager_assignments
    WHERE property_id = _property_id AND manager_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_property(_property_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.properties p
    JOIN public.owner_entity_users oeu ON oeu.owner_entity_id = p.owner_entity_id
    WHERE p.id = _property_id AND oeu.user_id = auth.uid()
  );
$$;

CREATE POLICY "Managers see assigned properties" ON public.properties FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND (public.is_admin() OR public.user_manages_property(id)));
CREATE POLICY "Owners see their properties" ON public.properties FOR SELECT TO authenticated
  USING (owner_entity_id IN (SELECT public.user_owner_entity_ids(auth.uid())));
CREATE POLICY "Managers write properties in org" ON public.properties FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_manager());

CREATE POLICY "See own manager assignments" ON public.property_manager_assignments FOR SELECT TO authenticated
  USING (manager_user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins write manager assignments" ON public.property_manager_assignments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- SUITES
-- ============================================================
CREATE TABLE public.suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  suite_number TEXT NOT NULL,
  floor TEXT,
  square_feet INT,
  suite_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suites TO authenticated;
GRANT ALL ON public.suites TO service_role;
ALTER TABLE public.suites ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_suites_property ON public.suites(property_id);
CREATE TRIGGER trg_suites_updated BEFORE UPDATE ON public.suites FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TENANT COMPANIES
-- ============================================================
CREATE TABLE public.tenant_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_companies TO authenticated;
GRANT ALL ON public.tenant_companies TO service_role;
ALTER TABLE public.tenant_companies ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tc_org ON public.tenant_companies(organization_id);
CREATE TRIGGER trg_tc_updated BEFORE UPDATE ON public.tenant_companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tenant_suite_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_company_id UUID NOT NULL REFERENCES public.tenant_companies(id) ON DELETE CASCADE,
  suite_id UUID NOT NULL REFERENCES public.suites(id) ON DELETE CASCADE,
  lease_start DATE,
  lease_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_company_id, suite_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_suite_assignments TO authenticated;
GRANT ALL ON public.tenant_suite_assignments TO service_role;
ALTER TABLE public.tenant_suite_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tsa_tenant ON public.tenant_suite_assignments(tenant_company_id);
CREATE INDEX idx_tsa_suite ON public.tenant_suite_assignments(suite_id);

CREATE TABLE public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_company_id UUID NOT NULL REFERENCES public.tenant_companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_primary_contact BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_company_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_users TO authenticated;
GRANT ALL ON public.tenant_users TO service_role;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tu_user ON public.tenant_users(user_id);

CREATE OR REPLACE FUNCTION public.user_tenant_company_ids(_user_id UUID)
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_company_id FROM public.tenant_users WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.user_tenant_suite_ids(_user_id UUID)
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tsa.suite_id
  FROM public.tenant_suite_assignments tsa
  JOIN public.tenant_users tu ON tu.tenant_company_id = tsa.tenant_company_id
  WHERE tu.user_id = _user_id;
$$;

-- suites policies
CREATE POLICY "Managers see suites of managed properties" ON public.suites FOR SELECT TO authenticated
  USING (public.user_manages_property(property_id));
CREATE POLICY "Owners see suites of owned properties" ON public.suites FOR SELECT TO authenticated
  USING (public.user_owns_property(property_id));
CREATE POLICY "Tenants see their assigned suites" ON public.suites FOR SELECT TO authenticated
  USING (id IN (SELECT public.user_tenant_suite_ids(auth.uid())));
CREATE POLICY "Managers write suites" ON public.suites FOR ALL TO authenticated
  USING (public.user_manages_property(property_id))
  WITH CHECK (public.user_manages_property(property_id));

-- tenant_companies
CREATE POLICY "Managers read tenant_companies in org" ON public.tenant_companies FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_manager());
CREATE POLICY "Tenants read their own company" ON public.tenant_companies FOR SELECT TO authenticated
  USING (id IN (SELECT public.user_tenant_company_ids(auth.uid())));
CREATE POLICY "Managers write tenant_companies" ON public.tenant_companies FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_manager());

-- tenant_suite_assignments
CREATE POLICY "Managers read tsa" ON public.tenant_suite_assignments FOR SELECT TO authenticated USING (public.is_manager());
CREATE POLICY "Tenants read own tsa" ON public.tenant_suite_assignments FOR SELECT TO authenticated
  USING (tenant_company_id IN (SELECT public.user_tenant_company_ids(auth.uid())));
CREATE POLICY "Managers write tsa" ON public.tenant_suite_assignments FOR ALL TO authenticated
  USING (public.is_manager()) WITH CHECK (public.is_manager());

-- tenant_users
CREATE POLICY "See own tenant_users" ON public.tenant_users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_manager());
CREATE POLICY "Admins write tenant_users" ON public.tenant_users FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- VENDORS
-- ============================================================
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trade TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  license_number TEXT,
  insurance_expiration DATE,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_vendors_org ON public.vendors(organization_id);
CREATE TRIGGER trg_vendors_updated BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Managers manage vendors" ON public.vendors FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public.is_manager())
  WITH CHECK (organization_id = public.current_org_id() AND public.is_manager());

-- ============================================================
-- MAINTENANCE REQUESTS
-- ============================================================
CREATE SEQUENCE public.request_number_seq START 1001;

CREATE TABLE public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_number TEXT UNIQUE NOT NULL DEFAULT ('MR-' || nextval('public.request_number_seq')),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  suite_id UUID REFERENCES public.suites(id) ON DELETE SET NULL,
  tenant_company_id UUID REFERENCES public.tenant_companies(id) ON DELETE SET NULL,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  description TEXT,
  category TEXT,

  tenant_urgency public.urgency_level NOT NULL DEFAULT 'routine',
  manager_urgency public.urgency_level,

  access_information TEXT,
  permission_to_enter BOOLEAN NOT NULL DEFAULT false,
  preferred_access_times TEXT,

  responsibility public.responsibility_type,
  responsibility_notes TEXT,
  recommended_action TEXT,

  assigned_vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,

  status public.request_status NOT NULL DEFAULT 'submitted',

  target_completion_date DATE,
  scheduled_date DATE,

  estimated_cost NUMERIC(12,2),
  approved_amount NUMERIC(12,2),
  final_cost NUMERIC(12,2),

  approval_required BOOLEAN NOT NULL DEFAULT true,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_requests TO authenticated;
GRANT ALL ON public.maintenance_requests TO service_role;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_mr_org ON public.maintenance_requests(organization_id);
CREATE INDEX idx_mr_property ON public.maintenance_requests(property_id);
CREATE INDEX idx_mr_status ON public.maintenance_requests(status);
CREATE INDEX idx_mr_manager ON public.maintenance_requests(assigned_manager_id);
CREATE INDEX idx_mr_tenant ON public.maintenance_requests(tenant_company_id);
CREATE INDEX idx_mr_suite ON public.maintenance_requests(suite_id);
CREATE TRIGGER trg_mr_updated BEFORE UPDATE ON public.maintenance_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.user_can_see_request(_request_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.maintenance_requests r
    WHERE r.id = _request_id AND (
      public.is_admin()
      OR public.user_manages_property(r.property_id)
      OR public.user_owns_property(r.property_id)
      OR r.tenant_company_id IN (SELECT public.user_tenant_company_ids(auth.uid()))
    )
  );
$$;

CREATE POLICY "Managers see requests on managed properties" ON public.maintenance_requests FOR SELECT TO authenticated
  USING (public.is_admin() OR public.user_manages_property(property_id));
CREATE POLICY "Owners see requests on owned properties" ON public.maintenance_requests FOR SELECT TO authenticated
  USING (public.user_owns_property(property_id));
CREATE POLICY "Tenants see own company requests" ON public.maintenance_requests FOR SELECT TO authenticated
  USING (tenant_company_id IN (SELECT public.user_tenant_company_ids(auth.uid())));

CREATE POLICY "Tenants insert requests for own company/suite" ON public.maintenance_requests FOR INSERT TO authenticated
  WITH CHECK (
    tenant_company_id IN (SELECT public.user_tenant_company_ids(auth.uid()))
    AND (suite_id IS NULL OR suite_id IN (SELECT public.user_tenant_suite_ids(auth.uid())))
  );
CREATE POLICY "Managers insert requests" ON public.maintenance_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_manager() AND organization_id = public.current_org_id());

CREATE POLICY "Managers update requests" ON public.maintenance_requests FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.user_manages_property(property_id))
  WITH CHECK (public.is_admin() OR public.user_manages_property(property_id));

-- ============================================================
-- REQUEST ATTACHMENTS
-- ============================================================
CREATE TABLE public.request_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT,
  content_type TEXT,
  size_bytes BIGINT,
  attachment_type public.attachment_type NOT NULL DEFAULT 'other',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_visible BOOLEAN NOT NULL DEFAULT true,
  owner_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_attachments TO authenticated;
GRANT ALL ON public.request_attachments TO service_role;
ALTER TABLE public.request_attachments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_att_request ON public.request_attachments(request_id);

CREATE POLICY "Managers see all attachments on visible requests" ON public.request_attachments FOR SELECT TO authenticated
  USING (
    public.is_manager() AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r WHERE r.id = request_id AND (public.is_admin() OR public.user_manages_property(r.property_id))
    )
  );
CREATE POLICY "Owners see owner-visible attachments" ON public.request_attachments FOR SELECT TO authenticated
  USING (
    owner_visible AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r WHERE r.id = request_id AND public.user_owns_property(r.property_id)
    )
  );
CREATE POLICY "Tenants see tenant-visible attachments" ON public.request_attachments FOR SELECT TO authenticated
  USING (
    tenant_visible AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r WHERE r.id = request_id
      AND r.tenant_company_id IN (SELECT public.user_tenant_company_ids(auth.uid()))
    )
  );
CREATE POLICY "Users insert attachments on visible requests" ON public.request_attachments FOR INSERT TO authenticated
  WITH CHECK (public.user_can_see_request(request_id));
CREATE POLICY "Managers write attachments" ON public.request_attachments FOR ALL TO authenticated
  USING (
    public.is_manager() AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r WHERE r.id = request_id AND (public.is_admin() OR public.user_manages_property(r.property_id))
    )
  );

-- ============================================================
-- ESTIMATES
-- ============================================================
CREATE TABLE public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  scope_of_work TEXT,
  is_recommended BOOLEAN NOT NULL DEFAULT false,
  attachment_id UUID REFERENCES public.request_attachments(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimates TO authenticated;
GRANT ALL ON public.estimates TO service_role;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_est_request ON public.estimates(request_id);
CREATE TRIGGER trg_est_updated BEFORE UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- tenants CANNOT see estimates. owners CAN, managers CAN.
CREATE POLICY "Managers and owners see estimates" ON public.estimates FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_requests r WHERE r.id = request_id AND (
        public.is_admin() OR public.user_manages_property(r.property_id) OR public.user_owns_property(r.property_id)
      )
    )
  );
CREATE POLICY "Managers write estimates" ON public.estimates FOR ALL TO authenticated
  USING (
    public.is_manager() AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r WHERE r.id = request_id AND (public.is_admin() OR public.user_manages_property(r.property_id))
    )
  ) WITH CHECK (public.is_manager());

-- ============================================================
-- APPROVAL REQUESTS (append-only history)
-- ============================================================
CREATE TABLE public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recommended_estimate_id UUID REFERENCES public.estimates(id) ON DELETE SET NULL,
  recommended_amount NUMERIC(12,2),
  manager_message TEXT,
  decision public.approval_decision NOT NULL DEFAULT 'pending',
  decision_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decision_message TEXT,
  decided_at TIMESTAMPTZ,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_appr_request ON public.approval_requests(request_id);

CREATE POLICY "Managers and owners see approvals" ON public.approval_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_requests r WHERE r.id = request_id AND (
        public.is_admin() OR public.user_manages_property(r.property_id) OR public.user_owns_property(r.property_id)
      )
    )
  );
CREATE POLICY "Managers create approvals" ON public.approval_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager() AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r WHERE r.id = request_id AND (public.is_admin() OR public.user_manages_property(r.property_id))
    )
  );
CREATE POLICY "Owners update decisions on their approvals" ON public.approval_requests FOR UPDATE TO authenticated
  USING (
    decision = 'pending' AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r WHERE r.id = request_id AND public.user_owns_property(r.property_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.maintenance_requests r WHERE r.id = request_id AND public.user_owns_property(r.property_id)
    )
  );

-- ============================================================
-- REQUEST COMMENTS
-- ============================================================
CREATE TABLE public.request_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  visibility public.comment_visibility NOT NULL DEFAULT 'internal_manager',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_comments TO authenticated;
GRANT ALL ON public.request_comments TO service_role;
ALTER TABLE public.request_comments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rc_request ON public.request_comments(request_id);

CREATE POLICY "Comment visibility" ON public.request_comments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.maintenance_requests r WHERE r.id = request_id) AND (
      -- managers see all
      (public.is_manager() AND EXISTS (SELECT 1 FROM public.maintenance_requests r WHERE r.id = request_id AND (public.is_admin() OR public.user_manages_property(r.property_id))))
      -- owners see manager_owner and all_parties
      OR (visibility IN ('manager_owner','all_parties') AND EXISTS (SELECT 1 FROM public.maintenance_requests r WHERE r.id = request_id AND public.user_owns_property(r.property_id)))
      -- tenants see manager_tenant and all_parties
      OR (visibility IN ('manager_tenant','all_parties') AND EXISTS (SELECT 1 FROM public.maintenance_requests r WHERE r.id = request_id AND r.tenant_company_id IN (SELECT public.user_tenant_company_ids(auth.uid()))))
    )
  );
CREATE POLICY "Users insert comments on visible requests" ON public.request_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.user_can_see_request(request_id));

-- ============================================================
-- FINANCIAL IMPACT NOTES
-- ============================================================
CREATE TABLE public.financial_impact_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category public.impact_category NOT NULL,
  timeframe public.impact_timeframe NOT NULL,
  amount NUMERIC(12,2),
  note TEXT NOT NULL,
  owner_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_impact_notes TO authenticated;
GRANT ALL ON public.financial_impact_notes TO service_role;
ALTER TABLE public.financial_impact_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_fi_request ON public.financial_impact_notes(request_id);

CREATE POLICY "Managers see all financial notes" ON public.financial_impact_notes FOR SELECT TO authenticated
  USING (
    public.is_manager() AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r WHERE r.id = request_id AND (public.is_admin() OR public.user_manages_property(r.property_id))
    )
  );
CREATE POLICY "Owners see owner-visible financial notes" ON public.financial_impact_notes FOR SELECT TO authenticated
  USING (
    owner_visible AND EXISTS (
      SELECT 1 FROM public.maintenance_requests r WHERE r.id = request_id AND public.user_owns_property(r.property_id)
    )
  );
CREATE POLICY "Managers write financial notes" ON public.financial_impact_notes FOR ALL TO authenticated
  USING (public.is_manager()) WITH CHECK (public.is_manager());

-- ============================================================
-- WORK COMPLETION RECORDS
-- ============================================================
CREATE TABLE public.work_completion_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  completed_on DATE,
  final_cost NUMERIC(12,2),
  invoice_number TEXT,
  warranty_details TEXT,
  warranty_expires_on DATE,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_completion_records TO authenticated;
GRANT ALL ON public.work_completion_records TO service_role;
ALTER TABLE public.work_completion_records ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_wcr_request ON public.work_completion_records(request_id);

CREATE POLICY "Managers and owners see completion records" ON public.work_completion_records FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_requests r WHERE r.id = request_id AND (
        public.is_admin() OR public.user_manages_property(r.property_id) OR public.user_owns_property(r.property_id)
      )
    )
  );
CREATE POLICY "Managers write completion records" ON public.work_completion_records FOR ALL TO authenticated
  USING (public.is_manager()) WITH CHECK (public.is_manager());

-- ============================================================
-- ACTIVITY LOGS & NOTIFICATIONS
-- ============================================================
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_al_request ON public.activity_logs(request_id);

CREATE POLICY "Users see activity for visible requests" ON public.activity_logs FOR SELECT TO authenticated
  USING (request_id IS NULL OR public.user_can_see_request(request_id));
CREATE POLICY "Authenticated insert activity" ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notif_user ON public.notifications(user_id);

CREATE POLICY "Own notifications" ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
