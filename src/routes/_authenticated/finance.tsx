import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { getFinanceOverview } from "@/lib/rpm.functions";
import { PageHeader, StatCard, money, StatusBadge } from "@/components/rpm-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";

const searchSchema = z.object({
  property: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Finance — C Street Management" }] }),
  validateSearch: zodValidator(searchSchema),
  component: FinancePage,
});

function FinancePage() {
  const { property } = Route.useSearch();
  const fn = useServerFn(getFinanceOverview);
  const { data, isLoading } = useQuery({ queryKey: ["finance-overview"], queryFn: () => fn() });

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading finance data…</div>;
  }

  if (property) {
    const p = data.perProperty.find(x => x.property.id === property);
    if (!p) return (
      <div className="p-6">
        <PageHeader title="Property not found" />
        <Link to="/finance"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Back to portfolio</Button></Link>
      </div>
    );
    return <PropertyFinance data={p} />;
  }

  return <PortfolioFinance data={data} />;
}

type Overview = Awaited<ReturnType<typeof getFinanceOverview>>;

function PortfolioFinance({ data }: { data: Overview }) {
  const { portfolio, perProperty } = data;
  const maxSpend = Math.max(1, ...portfolio.monthly.map(m => m.spend));

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Finance overview"
        description={`Portfolio-wide maintenance spend across ${portfolio.properties} propert${portfolio.properties === 1 ? "y" : "ies"}.`}
      />

      <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard label="Final spend (all time)" value={money(portfolio.totals.final)} tone="success" />
        <StatCard label="Approved commitments" value={money(portfolio.totals.approved)} hint="Owner-approved amounts" />
        <StatCard label="Estimated pipeline" value={money(portfolio.totals.estimated)} hint="All estimates on file" />
        <StatCard
          label="Awaiting approval"
          value={money(portfolio.totals.awaitingApprovalDollars)}
          tone="warning"
          to="/requests"
          search={{ status: "awaiting_owner_approval" }}
        />
        <StatCard label="Owner responsibility" value={money(portfolio.totals.ownerSpend)} hint="Final spend booked to owner" />
        <StatCard label="Tenant responsibility" value={money(portfolio.totals.tenantSpend)} hint="Reimbursable / tenant-billed" />
        <StatCard
          label="Approved vs final variance"
          value={money(portfolio.totals.variance)}
          tone={portfolio.totals.variance > 0 ? "urgent" : portfolio.totals.variance < 0 ? "success" : "default"}
          hint={portfolio.totals.variance > 0 ? "Over budget" : portfolio.totals.variance < 0 ? "Under budget" : "On budget"}
        />
        <StatCard label="Open work orders" value={portfolio.openCount} to="/requests" />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Final spend — trailing 12 months</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5 h-40">
              {portfolio.monthly.map(m => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t bg-primary/70 group-hover:bg-primary transition-colors relative"
                      style={{ height: `${(m.spend / maxSpend) * 100}%`, minHeight: m.spend > 0 ? 2 : 0 }}
                    >
                      {m.spend > 0 && (
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap bg-popover text-popover-foreground border rounded px-1.5 py-0.5">
                          {money(m.spend)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-[9px] text-muted-foreground">{m.month.slice(5)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top vendors by spend</CardTitle></CardHeader>
          <CardContent>
            {portfolio.topVendors.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">No vendor spend recorded yet.</div>
            )}
            <div className="space-y-2">
              {portfolio.topVendors.map(v => (
                <div key={v.name} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{v.name}</div>
                    <div className="text-xs text-muted-foreground">{v.jobs} job{v.jobs === 1 ? "" : "s"}</div>
                  </div>
                  <div className="font-mono">{money(v.total)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">By property</h2>
          <div className="text-xs text-muted-foreground">Click a row to drill down</div>
        </div>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Property</th>
                <th className="text-right px-3 py-2 font-medium">Requests</th>
                <th className="text-right px-3 py-2 font-medium">Open</th>
                <th className="text-right px-3 py-2 font-medium">Estimated</th>
                <th className="text-right px-3 py-2 font-medium">Approved</th>
                <th className="text-right px-3 py-2 font-medium">Final</th>
                <th className="text-right px-3 py-2 font-medium">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {perProperty.map(p => {
                const v = p.totals.variance;
                const Icon = v > 0 ? TrendingUp : v < 0 ? TrendingDown : Minus;
                const tone = v > 0 ? "text-destructive" : v < 0 ? "text-success" : "text-muted-foreground";
                return (
                  <tr key={p.property.id} className="hover:bg-muted/40 cursor-pointer">
                    <td className="px-3 py-2">
                      <Link to="/finance" search={{ property: p.property.id }} className="flex items-center gap-2 hover:underline">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{p.property.name}</div>
                          <div className="text-xs text-muted-foreground">{[p.property.city, p.property.state].filter(Boolean).join(", ")}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">{p.counts.total}</td>
                    <td className="px-3 py-2 text-right">{p.counts.open}</td>
                    <td className="px-3 py-2 text-right font-mono">{money(p.totals.estimated)}</td>
                    <td className="px-3 py-2 text-right font-mono">{money(p.totals.approved)}</td>
                    <td className="px-3 py-2 text-right font-mono">{money(p.totals.final)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${tone}`}>
                      <div className="flex items-center justify-end gap-1">
                        <Icon className="h-3 w-3" />{money(Math.abs(v))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {perProperty.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-8">No properties yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PropertyFinance({ data: p }: { data: Overview["perProperty"][number] }) {
  const maxSpend = Math.max(1, ...p.monthly.map(m => m.spend));
  const v = p.totals.variance;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/finance"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" /> Portfolio</Button></Link>
      </div>
      <PageHeader
        title={p.property.name}
        description={[p.property.property_type, [p.property.city, p.property.state].filter(Boolean).join(", "), p.property.square_feet ? `${p.property.square_feet.toLocaleString()} sq ft` : null].filter(Boolean).join(" · ")}
      />

      <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard label="Final spend" value={money(p.totals.final)} tone="success" />
        <StatCard label="Approved" value={money(p.totals.approved)} />
        <StatCard label="Estimated pipeline" value={money(p.totals.estimated)} />
        <StatCard label="Variance" value={money(Math.abs(v))} tone={v > 0 ? "urgent" : v < 0 ? "success" : "default"} hint={v > 0 ? "Over approved" : v < 0 ? "Under approved" : "On budget"} />
        <StatCard label="Total requests" value={p.counts.total} />
        <StatCard label="Open" value={p.counts.open} />
        <StatCard label="Awaiting approval" value={money(p.totals.awaitingApprovalDollars)} tone="warning" to="/requests" search={{ status: "awaiting_owner_approval" }} />
        <StatCard label="Owner / Tenant split" value={`${money(p.totals.ownerSpend)} / ${money(p.totals.tenantSpend)}`} hint="Final spend by responsibility" />
      </section>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Final spend — trailing 12 months</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-1.5 h-40">
            {p.monthly.map(m => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="w-full flex-1 flex items-end">
                  <div className="w-full rounded-t bg-primary/70 group-hover:bg-primary transition-colors relative" style={{ height: `${(m.spend / maxSpend) * 100}%`, minHeight: m.spend > 0 ? 2 : 0 }}>
                    {m.spend > 0 && (
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap bg-popover text-popover-foreground border rounded px-1.5 py-0.5">
                        {money(m.spend)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-[9px] text-muted-foreground">{m.month.slice(5)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent activity</h2>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">#</th>
                <th className="text-left px-3 py-2 font-medium">Title</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Vendor</th>
                <th className="text-right px-3 py-2 font-medium">Est.</th>
                <th className="text-right px-3 py-2 font-medium">Approved</th>
                <th className="text-right px-3 py-2 font-medium">Final</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {p.recent.map(r => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link to="/requests/$id" params={{ id: r.id }} className="text-primary hover:underline">{r.request_number}</Link>
                  </td>
                  <td className="px-3 py-2">{r.title}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{r.vendor ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{money(r.estimated_cost)}</td>
                  <td className="px-3 py-2 text-right font-mono">{money(r.approved_amount)}</td>
                  <td className="px-3 py-2 text-right font-mono">{money(r.final_cost)}</td>
                </tr>
              ))}
              {p.recent.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-8">No activity yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
