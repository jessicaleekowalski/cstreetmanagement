import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const OWNER_ENTITY_ID = "00000000-0000-0000-0000-000000000010";
const OWNER_TENANT_COMPANY_ID = "00000000-0000-0000-0000-000000000300"; // Cape Fear Legal
const PROPERTY_IDS = [
  "00000000-0000-0000-0000-000000000100",
  "00000000-0000-0000-0000-000000000101",
];

// -------- Whoami: returns profile + active roles + linked entities --------
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Ensure profile is linked to the demo org (so RLS org checks succeed)
    await supabase
      .from("profiles")
      .update({ organization_id: ORG_ID })
      .eq("id", userId)
      .is("organization_id", null);

    const [{ data: profile }, { data: rolesData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const roles = (rolesData ?? []).map(r => r.role as string);
    return {
      userId,
      email: context.claims.email as string | undefined,
      profile,
      roles,
    };
  });

// -------- Assign demo role + wire up the entity links --------
const RoleInput = z.object({
  role: z.enum(["admin", "property_manager", "owner", "tenant"]),
});

export const setDemoRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => RoleInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { role } = data;
    // Demo bootstrap: role assignment requires admin privileges (user_roles is admin-only).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Reset: remove existing roles + membership rows so the user can flip roles cleanly.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("property_manager_assignments").delete().eq("manager_user_id", userId);
    await supabaseAdmin.from("owner_entity_users").delete().eq("user_id", userId);
    await supabaseAdmin.from("tenant_users").delete().eq("user_id", userId);

    // Make sure profile → org is set (caller can update their own profile)
    await supabase.from("profiles").update({ organization_id: ORG_ID }).eq("id", userId);

    // Insert new role via admin (RLS locks user_roles to admins only)
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, organization_id: ORG_ID, role });
    if (roleErr) throw new Error(roleErr.message);

    // Wire memberships based on role. Use admin client so writes aren't blocked by RLS.
    if (role === "property_manager" || role === "admin") {
      const rows = PROPERTY_IDS.map(pid => ({ property_id: pid, manager_user_id: userId }));
      await supabaseAdmin.from("property_manager_assignments").insert(rows);
    }
    if (role === "owner") {
      await supabaseAdmin.from("owner_entity_users").insert({ owner_entity_id: OWNER_ENTITY_ID, user_id: userId });
    }
    if (role === "tenant") {
      await supabaseAdmin.from("tenant_users").insert({
        tenant_company_id: OWNER_TENANT_COMPANY_ID,
        user_id: userId,
        is_primary_contact: true,
      });
    }

    return { ok: true };
  });

// -------- List maintenance requests (RLS scopes rows to caller) --------
export const listRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("maintenance_requests")
      .select(`
        id, request_number, title, status, tenant_urgency, manager_urgency,
        estimated_cost, approved_amount, final_cost, submitted_at,
        target_completion_date, scheduled_date, completed_at,
        property:properties(id, name), suite:suites(id, suite_number),
        tenant_company:tenant_companies(id, name),
        assigned_vendor:vendors(id, name)
      `)
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// -------- Request detail --------
export const getRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const s = context.supabase;
    const [req, estimates, approvals, comments, finImpact, completion, attachments] = await Promise.all([
      s.from("maintenance_requests").select(`
        *, property:properties(*), suite:suites(*),
        tenant_company:tenant_companies(*), assigned_vendor:vendors(*)
      `).eq("id", data.id).maybeSingle(),
      s.from("estimates").select("*, vendor:vendors(id, name)").eq("request_id", data.id).order("received_at"),
      s.from("approval_requests").select("*").eq("request_id", data.id).order("requested_at"),
      s.from("request_comments").select("*").eq("request_id", data.id).order("created_at"),
      s.from("financial_impact_notes").select("*").eq("request_id", data.id).order("created_at"),
      s.from("work_completion_records").select("*, vendor:vendors(id, name)").eq("request_id", data.id).order("created_at"),
      s.from("request_attachments").select("*").eq("request_id", data.id).order("created_at"),
    ]);
    if (req.error) throw new Error(req.error.message);
    if (!req.data) throw new Error("Request not found");
    return {
      request: req.data,
      estimates: estimates.data ?? [],
      approvals: approvals.data ?? [],
      comments: comments.data ?? [],
      financialImpact: finImpact.data ?? [],
      completion: completion.data ?? [],
      attachments: attachments.data ?? [],
    };
  });

// -------- Tenant creates a request --------
const NewRequestInput = z.object({
  property_id: z.string().uuid(),
  suite_id: z.string().uuid(),
  tenant_company_id: z.string().uuid(),
  title: z.string().min(3).max(160),
  description: z.string().max(4000).optional(),
  category: z.string().max(80).optional(),
  tenant_urgency: z.enum(["routine", "soon", "urgent", "emergency"]),
  access_information: z.string().max(500).optional(),
  permission_to_enter: z.boolean(),
  preferred_access_times: z.string().max(200).optional(),
});

export const createRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => NewRequestInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await context.supabase
      .from("maintenance_requests")
      .insert({
        organization_id: ORG_ID,
        submitted_by: context.userId,
        status: "submitted",
        approval_required: true,
        ...data,
      })
      .select("id, request_number")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

// -------- Owner acts on approval --------
const ApprovalActionInput = z.object({
  approval_id: z.string().uuid(),
  decision: z.enum(["approved", "declined", "additional_estimate_requested", "question"]),
  message: z.string().max(1000).optional(),
});

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ApprovalActionInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: appr, error: aErr } = await context.supabase
      .from("approval_requests")
      .update({
        decision: data.decision,
        decision_by: context.userId,
        decision_message: data.message,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.approval_id)
      .select("id, request_id, recommended_amount")
      .single();
    if (aErr) throw new Error(aErr.message);

    // Roll forward the request status based on the decision
    const statusMap = {
      approved: "approved",
      declined: "declined",
      additional_estimate_requested: "additional_estimate_requested",
      question: "owner_question",
    } as const;
    const newStatus = statusMap[data.decision];
    if (data.decision === "approved") {
      await context.supabase.from("maintenance_requests")
        .update({ status: newStatus, approved_amount: appr.recommended_amount })
        .eq("id", appr.request_id);
    } else {
      await context.supabase.from("maintenance_requests")
        .update({ status: newStatus })
        .eq("id", appr.request_id);
    }
    return { ok: true };
  });

// -------- Data for the tenant request form --------
export const getTenantContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = context.supabase;
    // Tenants: get companies + assigned suites
    const { data: companies } = await s.from("tenant_companies").select("id, name");
    const { data: suites } = await s.from("suites").select("id, suite_number, property_id, property:properties(id, name)");
    const { data: tsa } = await s.from("tenant_suite_assignments").select("tenant_company_id, suite_id");
    return {
      companies: companies ?? [],
      suites: suites ?? [],
      assignments: tsa ?? [],
    };
  });

// -------- Aggregate metrics for dashboards --------
export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = context.supabase;
    const { data: requests } = await s
      .from("maintenance_requests")
      .select("id, status, tenant_urgency, manager_urgency, estimated_cost, approved_amount, final_cost, target_completion_date, submitted_at, completed_at, property_id");
    const list = requests ?? [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const isOpen = (s: string) => !["completed", "closed", "cancelled", "declined"].includes(s);

    const stats = {
      total: list.length,
      newRequests: list.filter(r => r.status === "submitted").length,
      urgent: list.filter(r => isOpen(r.status) && (r.manager_urgency === "urgent" || r.tenant_urgency === "urgent" || r.manager_urgency === "emergency" || r.tenant_urgency === "emergency")).length,
      awaitingInfo: list.filter(r => r.status === "awaiting_information").length,
      needsEstimate: list.filter(r => r.status === "estimating").length,
      awaitingApproval: list.filter(r => r.status === "awaiting_owner_approval").length,
      dollarsAwaitingApproval: list.filter(r => r.status === "awaiting_owner_approval").reduce((a, r) => a + Number(r.estimated_cost ?? 0), 0),
      approvedNeedingCoord: list.filter(r => r.status === "approved" || r.status === "vendor_coordination").length,
      scheduled: list.filter(r => r.status === "scheduled").length,
      overdue: list.filter(r => isOpen(r.status) && r.target_completion_date && new Date(r.target_completion_date) < now).length,
      awaitingInvoice: list.filter(r => r.status === "work_completed" || r.status === "invoice_pending").length,
      openWorkOrders: list.filter(r => isOpen(r.status)).length,
      approvedMonth: list.filter(r => r.submitted_at && new Date(r.submitted_at) >= monthStart).reduce((a, r) => a + Number(r.approved_amount ?? 0), 0),
      finalMonth: list.filter(r => r.completed_at && new Date(r.completed_at) >= monthStart).reduce((a, r) => a + Number(r.final_cost ?? 0), 0),
      totalEstimated: list.reduce((a, r) => a + Number(r.estimated_cost ?? 0), 0),
      totalFinal: list.reduce((a, r) => a + Number(r.final_cost ?? 0), 0),
    };
    return stats;
  });

// -------- Properties / vendors / notifications lists --------
export const listProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("properties")
      .select("*, owner_entity:owner_entities(name), suites(id)")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listVendors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("vendors").select("*").order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// -------- Managers create an estimate (optionally with an uploaded invoice) --------
const CreateEstimateInput = z.object({
  request_id: z.string().uuid(),
  vendor_id: z.string().uuid(),
  amount: z.number().positive().max(10_000_000),
  description: z.string().trim().max(500).optional().nullable(),
  scope_of_work: z.string().trim().max(2000).optional().nullable(),
  is_recommended: z.boolean().optional(),
  invoice: z.object({
    storage_path: z.string().min(1).max(500),
    file_name: z.string().min(1).max(255),
    content_type: z.string().max(120).optional().nullable(),
    size_bytes: z.number().int().nonnegative().optional().nullable(),
  }).optional().nullable(),
});

export const createEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CreateEstimateInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let attachment_id: string | null = null;
    if (data.invoice) {
      const { data: att, error: attErr } = await supabase
        .from("request_attachments")
        .insert({
          request_id: data.request_id,
          storage_path: data.invoice.storage_path,
          file_name: data.invoice.file_name,
          content_type: data.invoice.content_type ?? null,
          size_bytes: data.invoice.size_bytes ?? null,
          attachment_type: "invoice",
          uploaded_by: userId,
          tenant_visible: false,
          owner_visible: true,
        })
        .select("id")
        .single();
      if (attErr) throw new Error(attErr.message);
      attachment_id = att.id;
    }
    const { data: est, error } = await supabase
      .from("estimates")
      .insert({
        request_id: data.request_id,
        vendor_id: data.vendor_id,
        amount: data.amount,
        description: data.description ?? null,
        scope_of_work: data.scope_of_work ?? null,
        is_recommended: data.is_recommended ?? false,
        attachment_id,
        received_at: new Date().toISOString(),
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: est.id, attachment_id };
  });

// -------- Signed URL for viewing an uploaded invoice/attachment --------
export const getAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ attachment_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: att, error } = await context.supabase
      .from("request_attachments")
      .select("storage_path, file_name")
      .eq("id", data.attachment_id)
      .maybeSingle();
    if (error || !att) throw new Error(error?.message ?? "Attachment not found");
    const { data: signed, error: sErr } = await context.supabase
      .storage.from("request-files")
      .createSignedUrl(att.storage_path, 60 * 10);
    if (sErr || !signed) throw new Error(sErr?.message ?? "Could not sign URL");
    return { url: signed.signedUrl, file_name: att.file_name };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

// -------- Pending approvals grouped by property (owner dashboard) --------
export const listPendingApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = context.supabase;
    const { data: approvals, error } = await s
      .from("approval_requests")
      .select("*, request:maintenance_requests(*, property:properties(id,name), suite:suites(suite_number), tenant_company:tenant_companies(name), assigned_vendor:vendors(name))")
      .eq("decision", "pending")
      .order("requested_at");
    if (error) throw new Error(error.message);
    return approvals ?? [];
  });
