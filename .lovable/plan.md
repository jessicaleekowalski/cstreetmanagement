# Commercial Property Management — Phase 1 Plan

Given the scope, I'll build this in a focused first pass covering the foundation you asked for last: layout + auth + roles + schema + RLS + seed + core dashboards + request workflow. Secondary features (property detail tabs, financial-impact editor UI, notifications center, admin screens) come in a second pass once the core is coherent.

## What ships in this pass

**Foundation**
- Enable Lovable Cloud (Supabase) and provision the schema below
- Design system in `src/styles.css`: warm neutral bg, navy text, muted blue/green accents, amber warnings, red urgent — commercial ops look, no residential/marketing feel
- Auth pages (email/password + Google), profile bootstrap on signup
- Role-based root layout with sidebar nav that adapts to role

**Database (all tables you listed)**
organizations, profiles, owner_entities, owner_entity_users, properties, property_manager_assignments, suites, tenant_companies, tenant_suite_assignments, tenant_users, vendors, maintenance_requests, request_attachments, estimates, approval_requests (append-only history), request_comments (with visibility enum), financial_impact_notes, work_completion_records, activity_logs, notifications.

Enums: `app_role` (admin, property_manager, owner, tenant), `request_status` (17 values), `urgency`, `responsibility`, `comment_visibility`, `attachment_type`, `impact_category`, `impact_timeframe`, `approval_decision`.

- UUID PKs, created_at/updated_at, FKs, indexes on hot paths (status, property_id, assigned_manager_id, tenant_company_id).
- User roles in a separate `user_roles` table with `has_role()` SECURITY DEFINER function (per project rules — never store roles on profiles).
- Helper security-definer fns: `user_org_id()`, `user_owner_entity_ids()`, `user_tenant_company_id()`, `user_manages_property(property_id)` — used by RLS to avoid recursion.

**RLS policies (enforced server-side)**
- Tenants: SELECT/INSERT only requests where `tenant_company_id` ∈ their companies AND `suite_id` ∈ their assigned suites. Cannot read estimates, approval_requests, financial_impact_notes, work_completion_records, or comments with visibility ≠ `manager_tenant`/`all_parties`.
- Owners: SELECT properties/requests where property's owner_entity ∈ their entities. Cannot read `internal_manager` comments or manager-only notes.
- Property managers: full CRUD on properties in their assignments and requests on those properties.
- Admins: full access within their organization.
- Attachments filtered by `tenant_visible`/`owner_visible` flags via RLS.
- Storage bucket `request-files` (private) — signed URLs only.

**Seed data (Wilmington, NC)**
- 1 org: "Cape Fear Commercial Management"
- 1 owner entity: "Riverfront Holdings LLC"
- 2 properties: "Market Street Professional Center" (Downtown Wilmington), "Oleander Commerce Park" (Midtown)
- 6 suites across both (mix of office + retail)
- 2 tenant companies: "Cape Fear Legal Group PA", "Azalea Coast Dental"
- 1 PM, 4 vendors (HVAC, plumbing, electrical, general), 4 sample requests spanning statuses (submitted, awaiting_owner_approval with estimates, in_progress, completed)

**Screens in this pass**
- `/auth` sign in / sign up
- `/` role-routed dashboard
- Manager dashboard: New/Urgent/Awaiting info/Needs estimate/Pending approval/Coord/Scheduled/Overdue/Awaiting invoice cards + estimated-vs-final summary + filter bar
- Owner dashboard: pending approval count + $ awaiting, urgent open, open WOs, approved/final MTD, est-vs-final, grouped approval cards with Approve / Decline / Request estimate / Ask question (with confirm dialog)
- Tenant `/requests/new`: mobile-friendly form, 911 emergency notice, photo upload, auto-lock single suite
- `/requests` list (role-filtered) and `/requests/$id` detail page with role-adapted sections and full approval history + activity timeline

**Deferred to next pass (call out explicitly)**
- Property detail tabs (Overview/Repair History/etc.) — list only in this pass
- Full Vendors/Owners/Tenants admin CRUD screens (seed + read-only list)
- Notifications center UI (table + inserts wired; UI stub)
- Financial-impact note editor UI (schema + read-only display)

## Technical notes

- TanStack Start file-based routing. Protected routes under `src/routes/_authenticated/`; `/auth` is public.
- All Supabase reads via `createServerFn` + `requireSupabaseAuth`; RLS does the actual authorization. No admin client for app reads.
- Attachments through Supabase Storage private bucket with signed URLs generated in a server fn.
- Approval history is append-only — new approval requests insert new rows; never UPDATE prior rows.
- shadcn/ui components styled via design tokens only (no hardcoded colors in JSX).

Ready to proceed? I'll enable Cloud, run the schema migration + seed, then build the UI top-down.
