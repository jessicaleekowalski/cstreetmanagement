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

// -------- Finance overview: portfolio-wide + per-property breakdown --------
export const getFinanceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = context.supabase;
    const year = new Date().getFullYear();
    const [propsRes, reqsRes, estRes, finRes, budRes, valRes, txnRes] = await Promise.all([
      s.from("properties").select("id, name, city, state, property_type, square_feet, owner_entity:owner_entities(name)").order("name"),
      s.from("maintenance_requests").select(`
        id, request_number, title, status, property_id, submitted_at, completed_at,
        estimated_cost, approved_amount, final_cost,
        manager_urgency, tenant_urgency, responsibility,
        assigned_vendor:vendors(id, name)
      `).order("submitted_at", { ascending: false }),
      s.from("estimates").select("id, request_id, amount, is_recommended, vendor:vendors(id, name)"),
      s.from("property_financials").select("*").order("period_month", { ascending: true }),
      s.from("property_budgets").select("*").eq("year", year),
      s.from("property_valuations").select("*").order("as_of_date", { ascending: false }),
      s.from("gl_transactions").select("*").order("txn_date", { ascending: false }).limit(2000),
    ]);
    if (propsRes.error) throw new Error(propsRes.error.message);
    if (reqsRes.error) throw new Error(reqsRes.error.message);

    const properties = propsRes.data ?? [];
    const requests = reqsRes.data ?? [];
    const estimates = estRes.data ?? [];
    const financials = finRes.data ?? [];
    const budgets = budRes.data ?? [];
    const valuations = valRes.data ?? [];
    const txns = txnRes.data ?? [];

    const num = (v: unknown) => Number(v ?? 0);
    const isOpen = (s: string) => !["completed", "closed", "cancelled", "declined"].includes(s);
    const now = new Date();
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(monthKey(d));
    }

    // Latest valuation per property
    const latestValuation = new Map<string, number>();
    for (const v of valuations) {
      if (!latestValuation.has(v.property_id)) latestValuation.set(v.property_id, num(v.market_value));
    }

    // Vendor spend across all requests
    const vendorMap = new Map<string, { name: string; total: number; jobs: number }>();
    for (const r of requests) {
      const v = r.assigned_vendor;
      if (!v || !r.final_cost) continue;
      const cur = vendorMap.get(v.id) ?? { name: v.name, total: 0, jobs: 0 };
      cur.total += num(r.final_cost);
      cur.jobs += 1;
      vendorMap.set(v.id, cur);
    }

    const perProperty = properties.map(p => {
      const rs = requests.filter(r => r.property_id === p.id);
      const fs = financials.filter(f => f.property_id === p.id);
      const bs = budgets.filter(b => b.property_id === p.id);
      const ts = txns.filter(t => t.property_id === p.id);

      const spendByMonth = new Map(months.map(m => [m, 0]));
      const incomeByMonth = new Map(months.map(m => [m, 0]));
      const expenseByMonth = new Map(months.map(m => [m, 0]));

      for (const r of rs) {
        if (r.completed_at && r.final_cost) {
          const k = monthKey(new Date(r.completed_at));
          if (spendByMonth.has(k)) spendByMonth.set(k, spendByMonth.get(k)! + num(r.final_cost));
        }
      }
      for (const f of fs) {
        const k = monthKey(new Date(f.period_month));
        if (incomeByMonth.has(k)) {
          incomeByMonth.set(k, incomeByMonth.get(k)! + num(f.gross_income) + num(f.other_income));
          expenseByMonth.set(k, expenseByMonth.get(k)! + num(f.operating_expenses));
        }
      }

      const totalIncome = fs.reduce((a, f) => a + num(f.gross_income) + num(f.other_income), 0);
      const totalOpex = fs.reduce((a, f) => a + num(f.operating_expenses), 0);
      const noi = totalIncome - totalOpex;
      const marketValue = latestValuation.get(p.id) ?? 0;
      const capRate = marketValue > 0 ? (noi / marketValue) * 100 : null;

      const totalBudget = bs.reduce((a, b) => a + num(b.budgeted_amount), 0);
      const budgetVariance = totalBudget - totalOpex;

      const totalEstimated = rs.reduce((a, r) => a + num(r.estimated_cost), 0);
      const totalApproved = rs.reduce((a, r) => a + num(r.approved_amount), 0);
      const totalFinal = rs.reduce((a, r) => a + num(r.final_cost), 0);
      const variance = totalFinal - totalApproved;
      const openCount = rs.filter(r => isOpen(r.status)).length;
      const awaitingApproval = rs.filter(r => r.status === "awaiting_owner_approval");
      const ownerSpend = rs.filter(r => r.responsibility === "owner").reduce((a, r) => a + num(r.final_cost), 0);
      const tenantSpend = rs.filter(r => r.responsibility === "tenant").reduce((a, r) => a + num(r.final_cost), 0);

      // Cash flow: last 6 months average, then forecast next 3
      const monthlyCash = months.map(m => ({
        month: m,
        income: incomeByMonth.get(m) ?? 0,
        expense: expenseByMonth.get(m) ?? 0,
        net: (incomeByMonth.get(m) ?? 0) - (expenseByMonth.get(m) ?? 0),
      }));
      const trailing6 = monthlyCash.slice(-6).filter(m => m.income > 0 || m.expense > 0);
      const avgNet = trailing6.length ? trailing6.reduce((a, m) => a + m.net, 0) / trailing6.length : 0;
      const avgIncome = trailing6.length ? trailing6.reduce((a, m) => a + m.income, 0) / trailing6.length : 0;
      const avgExpense = trailing6.length ? trailing6.reduce((a, m) => a + m.expense, 0) / trailing6.length : 0;
      const forecast: { month: string; income: number; expense: number; net: number }[] = [];
      for (let i = 1; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        forecast.push({ month: monthKey(d), income: avgIncome, expense: avgExpense, net: avgNet });
      }

      // Budget vs actual by category
      const actualByCategory = new Map<string, number>();
      for (const t of ts) {
        if (t.txn_type !== "expense" || !t.category) continue;
        actualByCategory.set(t.category, (actualByCategory.get(t.category) ?? 0) + num(t.amount));
      }
      const budgetLines = bs.map(b => ({
        category: b.category,
        budgeted: num(b.budgeted_amount),
        actual: actualByCategory.get(b.category) ?? 0,
      })).sort((a, b) => (b.actual - b.budgeted) - (a.actual - a.budgeted));

      return {
        property: p,
        counts: {
          total: rs.length,
          open: openCount,
          completed: rs.filter(r => r.status === "completed").length,
          awaitingApproval: awaitingApproval.length,
          financialsMonths: fs.length,
          budgetLines: bs.length,
          transactions: ts.length,
        },
        totals: {
          estimated: totalEstimated,
          approved: totalApproved,
          final: totalFinal,
          variance,
          awaitingApprovalDollars: awaitingApproval.reduce((a, r) => a + num(r.estimated_cost), 0),
          ownerSpend,
          tenantSpend,
          income: totalIncome,
          opex: totalOpex,
          noi,
          capRate,
          marketValue,
          budget: totalBudget,
          budgetVariance,
        },
        monthly: months.map(m => ({ month: m, spend: spendByMonth.get(m) ?? 0 })),
        cashFlow: monthlyCash,
        forecast,
        budgetLines,
        recent: rs.slice(0, 5).map(r => ({
          id: r.id,
          request_number: r.request_number,
          title: r.title,
          status: r.status,
          final_cost: r.final_cost,
          approved_amount: r.approved_amount,
          estimated_cost: r.estimated_cost,
          vendor: r.assigned_vendor?.name ?? null,
          completed_at: r.completed_at,
        })),
      };
    });

    const sum = (fn: (p: typeof perProperty[number]) => number) => perProperty.reduce((a, p) => a + fn(p), 0);
    const portfolioIncome = sum(p => p.totals.income);
    const portfolioOpex = sum(p => p.totals.opex);
    const portfolioNoi = portfolioIncome - portfolioOpex;
    const portfolioValue = sum(p => p.totals.marketValue);
    const portfolioCap = portfolioValue > 0 ? (portfolioNoi / portfolioValue) * 100 : null;

    const portfolio = {
      properties: properties.length,
      hasFinancialData: financials.length > 0 || budgets.length > 0 || txns.length > 0,
      totals: {
        estimated: sum(p => p.totals.estimated),
        approved: sum(p => p.totals.approved),
        final: sum(p => p.totals.final),
        variance: sum(p => p.totals.variance),
        awaitingApprovalDollars: sum(p => p.totals.awaitingApprovalDollars),
        ownerSpend: sum(p => p.totals.ownerSpend),
        tenantSpend: sum(p => p.totals.tenantSpend),
        income: portfolioIncome,
        opex: portfolioOpex,
        noi: portfolioNoi,
        marketValue: portfolioValue,
        capRate: portfolioCap,
        budget: sum(p => p.totals.budget),
        budgetVariance: sum(p => p.totals.budgetVariance),
      },
      monthly: months.map(m => ({
        month: m,
        spend: perProperty.reduce((a, p) => a + (p.monthly.find(x => x.month === m)?.spend ?? 0), 0),
        income: perProperty.reduce((a, p) => a + (p.cashFlow.find(x => x.month === m)?.income ?? 0), 0),
        expense: perProperty.reduce((a, p) => a + (p.cashFlow.find(x => x.month === m)?.expense ?? 0), 0),
      })),
      topVendors: [...vendorMap.values()].sort((a, b) => b.total - a.total).slice(0, 5),
      openCount: requests.filter(r => isOpen(r.status)).length,
      estimatesCount: estimates.length,
    };

    return { portfolio, perProperty };
  });

// -------- Upload helpers: parse client-side, POST parsed rows --------
const FinancialRow = z.object({
  property_id: z.string().uuid(),
  period_month: z.string(), // YYYY-MM-DD or YYYY-MM
  gross_income: z.number().nonnegative().default(0),
  operating_expenses: z.number().nonnegative().default(0),
  other_income: z.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
});
const BudgetRow = z.object({
  property_id: z.string().uuid(),
  year: z.number().int(),
  category: z.string().min(1),
  budgeted_amount: z.number(),
  notes: z.string().optional().nullable(),
});
const TxnRow = z.object({
  property_id: z.string().uuid(),
  txn_date: z.string(),
  txn_type: z.enum(["income", "expense"]),
  category: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  amount: z.number(),
});
const ValuationRow = z.object({
  property_id: z.string().uuid(),
  as_of_date: z.string(),
  market_value: z.number().nonnegative(),
  source: z.string().optional().nullable(),
});

function normalizeMonth(v: string): string {
  // Accept YYYY-MM, YYYY-MM-DD, or MM/YYYY -> normalize to YYYY-MM-01
  const s = v.trim();
  const m1 = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(s);
  if (m1) return `${m1[1]}-${m1[2]}-01`;
  const m2 = /^(\d{1,2})\/(\d{4})$/.exec(s);
  if (m2) return `${m2[2]}-${m2[1].padStart(2, "0")}-01`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  throw new Error(`Invalid month: ${v}`);
}

export const uploadFinancials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ rows: z.array(FinancialRow) }).parse(raw))
  .handler(async ({ data, context }) => {
    const rows = data.rows.map(r => ({ ...r, period_month: normalizeMonth(r.period_month), created_by: context.userId }));
    const { error, count } = await context.supabase
      .from("property_financials")
      .upsert(rows, { onConflict: "property_id,period_month", count: "exact" });
    if (error) throw new Error(error.message);
    return { inserted: count ?? rows.length };
  });

export const uploadBudgets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ rows: z.array(BudgetRow) }).parse(raw))
  .handler(async ({ data, context }) => {
    const rows = data.rows.map(r => ({ ...r, created_by: context.userId }));
    const { error, count } = await context.supabase
      .from("property_budgets")
      .upsert(rows, { onConflict: "property_id,year,category", count: "exact" });
    if (error) throw new Error(error.message);
    return { inserted: count ?? rows.length };
  });

export const uploadTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ rows: z.array(TxnRow) }).parse(raw))
  .handler(async ({ data, context }) => {
    const rows = data.rows.map(r => ({ ...r, created_by: context.userId }));
    const { error, count } = await context.supabase
      .from("gl_transactions")
      .insert(rows, { count: "exact" });
    if (error) throw new Error(error.message);
    return { inserted: count ?? rows.length };
  });

export const uploadValuations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ rows: z.array(ValuationRow) }).parse(raw))
  .handler(async ({ data, context }) => {
    const rows = data.rows.map(r => ({ ...r, created_by: context.userId }));
    const { error, count } = await context.supabase
      .from("property_valuations")
      .upsert(rows, { onConflict: "property_id,as_of_date", count: "exact" });
    if (error) throw new Error(error.message);
    return { inserted: count ?? rows.length };
  });

export const clearFinancialData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    kind: z.enum(["financials", "budgets", "transactions", "valuations"]),
    property_id: z.string().uuid().optional(),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    const s = context.supabase;
    const run = async (table: "property_financials" | "property_budgets" | "gl_transactions" | "property_valuations") => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = (s.from as any)(table).delete();
      if (data.property_id) q = q.eq("property_id", data.property_id);
      else q = q.not("id", "is", null);
      return await q;
    };
    const map = { financials: "property_financials", budgets: "property_budgets", transactions: "gl_transactions", valuations: "property_valuations" } as const;
    const res = await run(map[data.kind]);
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
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
