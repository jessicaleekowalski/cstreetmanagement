import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, money } from "@/components/rpm-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finance_/rent-advisor")({
  head: () => ({ meta: [{ title: "Rent Adjustment Advisor" }] }),
  component: RentAdvisor,
});

type Factor = {
  key: string;
  label: string;
  // suggested rent-uplift contribution when toggled ON (percentage points)
  weight: number;
  category: "opex" | "capex" | "debt" | "performance";
  hint?: string;
};

const FACTORS: Factor[] = [
  { key: "taxes", label: "Property taxes increased", weight: 1.5, category: "opex" },
  { key: "insurance", label: "Property insurance increased", weight: 1.2, category: "opex" },
  { key: "cam", label: "Common-area maintenance costs increased", weight: 0.8, category: "opex" },
  { key: "utilities", label: "Utilities increased", weight: 0.7, category: "opex" },
  { key: "landscaping", label: "Landscaping increased", weight: 0.3, category: "opex" },
  { key: "repairs", label: "Repairs and maintenance increased", weight: 0.8, category: "opex" },
  { key: "hvac", label: "HVAC service costs increased", weight: 0.5, category: "opex" },
  { key: "security", label: "Security or fire-monitoring costs increased", weight: 0.3, category: "opex" },
  { key: "cleaning", label: "Cleaning costs increased", weight: 0.4, category: "opex" },
  { key: "waste", label: "Waste-removal costs increased", weight: 0.3, category: "opex" },
  { key: "mgmt", label: "Property-management costs increased", weight: 0.5, category: "opex" },
  { key: "compliance", label: "Required compliance or code-upgrade costs", weight: 0.8, category: "capex" },
  { key: "capexDone", label: "Capital improvements completed", weight: 1.5, category: "capex", hint: "Justifies uplift for improved space" },
  { key: "capexPlanned", label: "Major capital expense anticipated", weight: 1.0, category: "capex" },
  { key: "debt", label: "Debt service increased", weight: 1.0, category: "debt" },
  { key: "rate", label: "Interest rate increased", weight: 0.8, category: "debt" },
  { key: "reserve", label: "Reserve balance below target", weight: 0.7, category: "performance" },
  { key: "opexPerSf", label: "Operating expense per square foot increased", weight: 1.0, category: "performance" },
  { key: "noiDown", label: "Net operating income decreased", weight: 1.5, category: "performance" },
  { key: "margin", label: "Current rent no longer covers target operating margin", weight: 2.0, category: "performance" },
];

const CATEGORY_LABEL: Record<Factor["category"], string> = {
  opex: "Operating expenses",
  capex: "Capital & compliance",
  debt: "Debt & financing",
  performance: "Performance signals",
};

function RentAdvisor() {
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [currentRent, setCurrentRent] = useState<string>("");
  const [sqft, setSqft] = useState<string>("");
  const [cpi, setCpi] = useState<string>("3.0");
  const [cap, setCap] = useState<string>("8.0");

  const activeFactors = FACTORS.filter(f => toggles[f.key]);
  const rawUplift = activeFactors.reduce((s, f) => s + f.weight, 0);
  const cpiPct = parseFloat(cpi) || 0;
  const capPct = parseFloat(cap) || 0;
  const suggestedPct = Math.min(rawUplift + cpiPct * 0.3, capPct);
  const rent = parseFloat(currentRent) || 0;
  const sf = parseFloat(sqft) || 0;
  const newRent = rent * (1 + suggestedPct / 100);
  const delta = newRent - rent;
  const rentPerSf = sf > 0 ? rent / sf : 0;
  const newRentPerSf = sf > 0 ? newRent / sf : 0;

  const grouped = useMemo(() => {
    const m: Record<string, Factor[]> = {};
    for (const f of FACTORS) (m[f.category] ||= []).push(f);
    return m;
  }, []);

  const urgency =
    suggestedPct >= 6 ? { label: "High priority", tone: "destructive" as const } :
    suggestedPct >= 3 ? { label: "Moderate", tone: "secondary" as const } :
    suggestedPct > 0 ? { label: "Low", tone: "outline" as const } :
    { label: "No adjustment indicated", tone: "outline" as const };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/finance"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Finance</Button></Link>
      </div>
      <PageHeader
        title="Rent Adjustment Advisor"
        description="Toggle the factors driving cost or performance pressure. We suggest a rent adjustment based on their combined weight."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {Object.entries(grouped).map(([cat, factors]) => (
            <Card key={cat}>
              <CardHeader><CardTitle className="text-base">{CATEGORY_LABEL[cat as Factor["category"]]}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {factors.map(f => (
                  <div key={f.key} className="flex items-center justify-between gap-4 rounded-md border p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{f.label}</div>
                      {f.hint && <div className="text-xs text-muted-foreground">{f.hint}</div>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground tabular-nums">+{f.weight.toFixed(1)}%</span>
                      <Switch
                        checked={!!toggles[f.key]}
                        onCheckedChange={(v) => setToggles(t => ({ ...t, [f.key]: v }))}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card className="sticky top-4">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Suggested adjustment</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-4xl font-semibold tabular-nums">{suggestedPct.toFixed(2)}%</div>
                <Badge variant={urgency.tone} className="mt-2">{urgency.label}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Current rent</div>
                  <div className="font-medium tabular-nums">{money(rent)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">New rent</div>
                  <div className="font-medium tabular-nums">{money(newRent)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Change</div>
                  <div className="font-medium tabular-nums">{money(delta)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">$/sf</div>
                  <div className="font-medium tabular-nums">{rentPerSf.toFixed(2)} → {newRentPerSf.toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <div className="space-y-1">
                  <Label htmlFor="rent">Current monthly rent</Label>
                  <Input id="rent" inputMode="decimal" value={currentRent} onChange={e => setCurrentRent(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sqft">Square footage</Label>
                  <Input id="sqft" inputMode="decimal" value={sqft} onChange={e => setSqft(e.target.value)} placeholder="0" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="cpi">CPI (%)</Label>
                    <Input id="cpi" inputMode="decimal" value={cpi} onChange={e => setCpi(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cap">Cap (%)</Label>
                    <Input id="cap" inputMode="decimal" value={cap} onChange={e => setCap(e.target.value)} />
                  </div>
                </div>
              </div>

              {activeFactors.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="text-xs text-muted-foreground mb-2">Active drivers ({activeFactors.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {activeFactors.map(f => <Badge key={f.key} variant="secondary" className="text-xs">{f.label}</Badge>)}
                  </div>
                </div>
              )}

              {suggestedPct >= capPct && rawUplift + cpiPct * 0.3 > capPct && (
                <div className="flex gap-2 text-xs text-muted-foreground rounded-md border p-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  Raw uplift exceeds the {capPct.toFixed(1)}% cap. Consider staging increases or negotiating pass-throughs.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
