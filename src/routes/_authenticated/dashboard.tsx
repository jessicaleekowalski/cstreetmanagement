import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe, getDashboardStats, listRequests, listPendingApprovals } from "@/lib/rpm.functions";
import { StatCard, StatusBadge, UrgencyBadge, PageHeader, money } from "@/components/rpm-ui";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, TriangleAlert, FileText, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — C Street Management" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const getMeFn = useServerFn(getMe);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });
  const roles = me?.roles ?? [];

  if (roles.includes("owner")) return <OwnerDashboard />;
  if (roles.includes("tenant")) return <TenantDashboard />;
  return <ManagerDashboard />;
}

function ManagerDashboard() {
  const statsFn = useServerFn(getDashboardStats);
  const listFn = useServerFn(listRequests);
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: () => statsFn() });
  const { data: requests } = useQuery({ queryKey: ["requests"], queryFn: () => listFn() });
  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Operations dashboard" description="All maintenance activity across your managed properties." />

      <section className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-5">
        <StatCard label="New requests" value={stats?.newRequests ?? 0} hint="Awaiting review" to="/requests" search={{ status: "submitted" }} />
        <StatCard label="Urgent / emergency" value={stats?.urgent ?? 0} tone="urgent" hint="Open issues" to="/requests" search={{ urgency: "urgent" }} />
        <StatCard label="Awaiting info" value={stats?.awaitingInfo ?? 0} tone="warning" to="/requests" search={{ status: "awaiting_information" }} />
        <StatCard label="Needs estimate" value={stats?.needsEstimate ?? 0} to="/requests" search={{ status: "estimating" }} />
        <StatCard label="Pending approval" value={stats?.awaitingApproval ?? 0} tone="warning" hint={money(stats?.dollarsAwaitingApproval)} to="/requests" search={{ status: "awaiting_owner_approval" }} />
        <StatCard label="Approved · needs coord" value={stats?.approvedNeedingCoord ?? 0} to="/requests" search={{ status: "approved" }} />
        <StatCard label="Scheduled" value={stats?.scheduled ?? 0} to="/requests" search={{ status: "scheduled" }} />
        <StatCard label="Overdue" value={stats?.overdue ?? 0} tone="urgent" to="/requests" search={{ status: "in_progress" }} />
        <StatCard label="Awaiting invoice" value={stats?.awaitingInvoice ?? 0} to="/requests" search={{ status: "work_completed" }} />
        <StatCard label="Estimated vs final" value={`${money(stats?.totalEstimated)} / ${money(stats?.totalFinal)}`} to="/requests" />
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent requests</h2>
          <Link to="/requests"><Button variant="ghost" size="sm">View all</Button></Link>
        </div>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">#</th>
                <th className="text-left px-3 py-2 font-medium">Issue</th>
                <th className="text-left px-3 py-2 font-medium">Property / Suite</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Urgency</th>
                <th className="text-right px-3 py-2 font-medium">Est.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(requests ?? []).slice(0, 8).map(r => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link to="/requests/$id" params={{ id: r.id }} className="text-primary hover:underline">{r.request_number}</Link>
                  </td>
                  <td className="px-3 py-2">{r.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.property?.name} · {r.suite?.suite_number ?? "—"}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2"><UrgencyBadge urgency={r.manager_urgency ?? r.tenant_urgency} /></td>
                  <td className="px-3 py-2 text-right">{money(r.estimated_cost)}</td>
                </tr>
              ))}
              {(requests ?? []).length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-8">No requests yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function OwnerDashboard() {
  const statsFn = useServerFn(getDashboardStats);
  const apprFn = useServerFn(listPendingApprovals);
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: () => statsFn() });
  const { data: pending } = useQuery({ queryKey: ["pending-approvals"], queryFn: () => apprFn() });

  const grouped = new Map<string, typeof pending>();
  for (const a of pending ?? []) {
    const key = a.request?.property?.name ?? "Unknown property";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(a);
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Owner overview" description="Riverfront Holdings LLC · Wilmington, NC" />

      <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard label="Pending approvals" value={stats?.awaitingApproval ?? 0} tone="warning" hint={money(stats?.dollarsAwaitingApproval) + " awaiting"} />
        <StatCard label="Urgent open issues" value={stats?.urgent ?? 0} tone="urgent" />
        <StatCard label="Open work orders" value={stats?.openWorkOrders ?? 0} />
        <StatCard label="Approved this month" value={money(stats?.approvedMonth)} />
        <StatCard label="Final spend this month" value={money(stats?.finalMonth)} tone="success" />
        <StatCard label="Estimated vs final (YTD)" value={`${money(stats?.totalEstimated)} / ${money(stats?.totalFinal)}`} />
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Pending approvals</h2>
        {grouped.size === 0 && (
          <Card><CardContent className="py-10 text-center text-muted-foreground text-sm">No pending approvals. Everything's up to date.</CardContent></Card>
        )}
        <div className="space-y-6">
          {[...grouped.entries()].map(([propName, approvals]) => (
            <div key={propName}>
              <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                <Building2 className="h-4 w-4 text-muted-foreground" /> {propName}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {approvals!.map(a => {
                  const req = a.request!;
                  const days = Math.floor((Date.now() - new Date(a.requested_at).getTime()) / 86_400_000);
                  return (
                    <Card key={a.id}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <CardTitle className="text-base">{req.title}</CardTitle>
                            <div className="text-xs text-muted-foreground mt-1">
                              {req.suite?.suite_number ?? "—"} · {req.tenant_company?.name ?? ""}
                            </div>
                          </div>
                          <UrgencyBadge urgency={req.manager_urgency ?? req.tenant_urgency} />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-muted-foreground">Recommended vendor</div>
                            <div>{req.assigned_vendor?.name ?? "—"}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Recommended amount</div>
                            <div className="font-medium">{money(a.recommended_amount ?? req.estimated_cost)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Responsibility</div>
                            <div className="capitalize">{req.responsibility ?? "—"}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Awaiting</div>
                            <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> {days} day{days === 1 ? "" : "s"}</div>
                          </div>
                        </div>
                        {a.manager_message && (
                          <div className="rounded-md bg-muted/50 border p-2 text-xs">
                            <div className="font-medium mb-0.5">Manager recommendation</div>
                            {a.manager_message}
                          </div>
                        )}
                        <div className="flex justify-end">
                          <Link to="/requests/$id" params={{ id: req.id }}>
                            <Button size="sm">Review & decide</Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TenantDashboard() {
  const listFn = useServerFn(listRequests);
  const { data: requests } = useQuery({ queryKey: ["requests"], queryFn: () => listFn() });
  const open = (requests ?? []).filter(r => !["completed", "closed", "cancelled"].includes(r.status));
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Your maintenance requests"
        description="Submit new issues and check on active work."
        actions={<Link to="/requests/new"><Button><FileText className="h-4 w-4 mr-2" /> New request</Button></Link>}
      />
      <div className="rounded-md border bg-warning/10 border-warning/40 p-4 flex gap-3 text-sm">
        <TriangleAlert className="h-4 w-4 text-warning-foreground shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">For fire, gas leaks, or immediate life-safety emergencies</div>
          <div className="text-muted-foreground">Call 911 and Wilmington Fire &amp; Rescue first, then submit a request here so we can coordinate follow-up work.</div>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Open requests</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {open.map(r => (
            <Link key={r.id} to="/requests/$id" params={{ id: r.id }}>
              <Card className="hover:border-primary/60 transition-colors">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{r.title}</div>
                    <UrgencyBadge urgency={r.tenant_urgency} />
                  </div>
                  <div className="text-xs text-muted-foreground">{r.suite?.suite_number} · {r.property?.name}</div>
                  <div className="flex items-center justify-between">
                    <StatusBadge status={r.status} />
                    <span className="text-xs font-mono text-muted-foreground">{r.request_number}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {open.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No open requests. Everything's quiet.</CardContent></Card>
          )}
        </div>
      </section>
    </div>
  );
}
