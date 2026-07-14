import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { getFinanceOverview } from "@/lib/rpm.functions";
import { PageHeader, StatCard, money, StatusBadge } from "@/components/rpm-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ArrowLeft, TrendingUp, TrendingDown, Minus, Upload } from "lucide-react";

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

function pct(n: number | null) {
  if (n == null) return "—";
  return `${n.toFixed(2)}%`;
}

function CashFlowChart({ history, forecast }: { history: { month: string; income: number; expense: number; net: number }[]; forecast: { month: string; income: number; expense: number; net: number }[] }) {
  const all = [...history, ...forecast];
  if (all.every(m => m.income === 0 && m.expense === 0)) {
    return <div className="text-sm text-muted-foreground py-8 text-center">No income/expense data uploaded yet.</div>;
  }
  const maxV = Math.max(1, ...all.map(m => Math.max(m.income, m.expense)));
  return (
    <div>
      <div className="flex items-end gap-1 h-44">
        {all.map((m, i) => {
          const isForecast = i >= history.length;
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="w-full flex-1 flex items-end gap-0.5">
                <div className={`w-1/2 rounded-t ${isForecast ? "bg-success/40" : "bg-success/70"}`} style={{ height: `${(m.income / maxV) * 100}%`, minHeight: m.income > 0 ? 2 : 0 }} title={`Income ${money(m.income)}`} />
                <div className={`w-1/2 rounded-t ${isForecast ? "bg-destructive/40" : "bg-destructive/70"}`} style={{ height: `${(m.expense / maxV) * 100}%`, minHeight: m.expense > 0 ? 2 : 0 }} title={`Expense ${money(m.expense)}`} />
              </div>
              <div className={`text-[9px] ${isForecast ? "text-muted-foreground italic" : "text-muted-foreground"}`}>{m.month.slice(5)}</div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-xs mt-2 text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-success/70 rounded-sm" /> Income</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-destructive/70 rounded-sm" /> Expense</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-muted-foreground/40 rounded-sm" /> Forecast (3mo)</span>
      </div>
    </div>
  );
}

function BudgetVsActual({ lines }: { lines: { category: string; budgeted: number; actual: number }[] }) {
  if (lines.length === 0) return <div className="text-sm text-muted-foreground py-8 text-center">No budget uploaded yet.</div>;
  const max = Math.max(1, ...lines.map(l => Math.max(l.budgeted, l.actual)));
  return (
    <div className="space-y-3">
      {lines.map(l => {
        const over = l.actual > l.budgeted && l.budgeted > 0;
        return (
          <div key={l.category}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium">{l.category}</span>
              <span className={over ? "text-destructive" : "text-muted-foreground"}>
                {money(l.actual)} / {money(l.budgeted)}
                {l.budgeted > 0 && <span className="ml-2">({((l.actual / l.budgeted) * 100).toFixed(0)}%)</span>}
              </span>
            </div>
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-primary/40" style={{ width: `${(l.budgeted / max) * 100}%` }} />
              <div className={`absolute inset-y-0 left-0 ${over ? "bg-destructive" : "bg-success"}`} style={{ width: `${Math.min(100, (l.actual / max) * 100)}%`, height: "60%", top: "20%" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PortfolioFinance({ data }: { data: Overview }) {
  const { portfolio, perProperty } = data;
  const t = portfolio.totals;
  const cashHistory = portfolio.monthly.map(m => ({ month: m.month, income: m.income, expense: m.expense, net: m.income - m.expense }));

  // aggregate budget lines across properties
  const budgetAgg = new Map<string, { budgeted: number; actual: number }>();
  for (const p of perProperty) {
    for (const l of p.budgetLines) {
      const cur = budgetAgg.get(l.category) ?? { budgeted: 0, actual: 0 };
      cur.budgeted += l.budgeted; cur.actual += l.actual;
      budgetAgg.set(l.category, cur);
    }
  }
  const budgetLines = [...budgetAgg.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => (b.actual - b.budgeted) - (a.actual - a.budgeted));

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Finance overview"
        description={`Portfolio-wide financials across ${portfolio.properties} propert${portfolio.properties === 1 ? "y" : "ies"}.`}
        actions={<Link to="/finance/upload"><Button size="sm"><Upload className="h-4 w-4 mr-2" /> Upload data</Button></Link>}
      />

      {!portfolio.hasFinancialData && (
        <div className="rounded-lg border border-info/50 bg-info/10 p-4 text-sm">
          <div className="font-medium">No financial data uploaded yet.</div>
          <div className="text-muted-foreground mt-1">Upload income/expenses, budgets, or transactions to populate the dashboard.</div>
          <Link to="/finance/upload" className="inline-block mt-2"><Button size="sm" variant="outline"><Upload className="h-4 w-4 mr-2" /> Get started</Button></Link>
        </div>
      )}

      <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard label="Total income" value={money(t.income)} tone="success" hint="Gross + other income" />
        <StatCard label="Operating expenses" value={money(t.opex)} hint="From uploaded financials" />
        <StatCard label="Net Operating Income" value={money(t.noi)} tone={t.noi >= 0 ? "success" : "urgent"} />
        <StatCard label="Cap rate" value={pct(t.capRate)} hint={t.marketValue ? `on ${money(t.marketValue)} value` : "Add valuations"} />
        <StatCard label="Budget" value={money(t.budget)} hint={`${new Date().getFullYear()} plan`} />
        <StatCard
          label="Budget variance"
          value={money(Math.abs(t.budgetVariance))}
          tone={t.budgetVariance < 0 ? "urgent" : "success"}
          hint={t.budgetVariance < 0 ? "Over budget" : "Under budget"}
        />
        <StatCard label="Maintenance spend" value={money(t.final)} hint="Work orders" />
        <StatCard label="Awaiting approval" value={money(t.awaitingApprovalDollars)} tone="warning" to="/requests" search={{ status: "awaiting_owner_approval" }} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Cash flow — 12 months + 3-month forecast</CardTitle></CardHeader>
          <CardContent>
            <CashFlowChart history={cashHistory} forecast={[]} />
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

      {budgetLines.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Budget vs actual — portfolio</CardTitle></CardHeader>
          <CardContent><BudgetVsActual lines={budgetLines} /></CardContent>
        </Card>
      )}

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
                <th className="text-right px-3 py-2 font-medium">Income</th>
                <th className="text-right px-3 py-2 font-medium">Opex</th>
                <th className="text-right px-3 py-2 font-medium">NOI</th>
                <th className="text-right px-3 py-2 font-medium">Cap</th>
                <th className="text-right px-3 py-2 font-medium">Budget var.</th>
                <th className="text-right px-3 py-2 font-medium">Maint.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {perProperty.map(p => {
                const bv = p.totals.budgetVariance;
                const Icon = bv < 0 ? TrendingUp : bv > 0 ? TrendingDown : Minus;
                const tone = bv < 0 ? "text-destructive" : bv > 0 ? "text-success" : "text-muted-foreground";
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
                    <td className="px-3 py-2 text-right font-mono">{money(p.totals.income)}</td>
                    <td className="px-3 py-2 text-right font-mono">{money(p.totals.opex)}</td>
                    <td className="px-3 py-2 text-right font-mono">{money(p.totals.noi)}</td>
                    <td className="px-3 py-2 text-right font-mono">{pct(p.totals.capRate)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${tone}`}>
                      <div className="flex items-center justify-end gap-1">
                        <Icon className="h-3 w-3" />{money(Math.abs(bv))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{money(p.totals.final)}</td>
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
  const t = p.totals;
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/finance"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" /> Portfolio</Button></Link>
        <div className="ml-auto"><Link to="/finance/upload"><Button size="sm" variant="outline"><Upload className="h-4 w-4 mr-2" /> Upload data</Button></Link></div>
      </div>
      <PageHeader
        title={p.property.name}
        description={[p.property.property_type, [p.property.city, p.property.state].filter(Boolean).join(", "), p.property.square_feet ? `${p.property.square_feet.toLocaleString()} sq ft` : null].filter(Boolean).join(" · ")}
      />

      <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard label="Total income" value={money(t.income)} tone="success" hint={`${p.counts.financialsMonths} month${p.counts.financialsMonths === 1 ? "" : "s"} logged`} />
        <StatCard label="Operating expenses" value={money(t.opex)} />
        <StatCard label="NOI" value={money(t.noi)} tone={t.noi >= 0 ? "success" : "urgent"} />
        <StatCard label="Cap rate" value={pct(t.capRate)} hint={t.marketValue ? `on ${money(t.marketValue)}` : "No valuation"} />
        <StatCard label="Budget" value={money(t.budget)} hint={`${p.counts.budgetLines} line${p.counts.budgetLines === 1 ? "" : "s"}`} />
        <StatCard label="Budget variance" value={money(Math.abs(t.budgetVariance))} tone={t.budgetVariance < 0 ? "urgent" : "success"} hint={t.budgetVariance < 0 ? "Over budget" : "Under budget"} />
        <StatCard label="Maintenance spend" value={money(t.final)} />
        <StatCard label="Awaiting approval" value={money(t.awaitingApprovalDollars)} tone="warning" to="/requests" search={{ status: "awaiting_owner_approval" }} />
      </section>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Cash flow — trailing 12 + 3-month forecast</CardTitle></CardHeader>
        <CardContent><CashFlowChart history={p.cashFlow} forecast={p.forecast} /></CardContent>
      </Card>

      {p.budgetLines.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Budget vs actual</CardTitle></CardHeader>
          <CardContent><BudgetVsActual lines={p.budgetLines} /></CardContent>
        </Card>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent maintenance</h2>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">#</th>
                <th className="text-left px-3 py-2 font-medium">Title</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Vendor</th>
                <th className="text-right px-3 py-2 font-medium">Final</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {p.recent.map(r => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2 font-mono text-xs"><Link to="/requests/$id" params={{ id: r.id }} className="text-primary hover:underline">{r.request_number}</Link></td>
                  <td className="px-3 py-2">{r.title}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{r.vendor ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{money(r.final_cost)}</td>
                </tr>
              ))}
              {p.recent.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted-foreground py-8">No activity yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
