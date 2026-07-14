import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createRequest, getTenantContext } from "@/lib/rpm.functions";
import { PageHeader } from "@/components/rpm-ui";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState, useMemo } from "react";

export const Route = createFileRoute("/_authenticated/requests/new")({
  head: () => ({ meta: [{ title: "New maintenance request — C-Street Management Group" }] }),
  component: NewRequestPage,
});

const urgencyOptions = [
  { value: "routine", label: "Routine — no rush" },
  { value: "soon", label: "Soon — this week" },
  { value: "urgent", label: "Urgent — impacts operations" },
  { value: "emergency", label: "Emergency — life safety / severe damage" },
];

const categoryOptions = [
  "HVAC", "Plumbing / Leak", "Electrical", "General / Building",
  "Doors & Locks", "Roof / Exterior", "Pest", "Janitorial", "Other",
];

function NewRequestPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const ctxFn = useServerFn(getTenantContext);
  const createFn = useServerFn(createRequest);
  const { data: ctx } = useQuery({ queryKey: ["tenant-context"], queryFn: () => ctxFn() });

  const [tenantCompanyId, setTenantCompanyId] = useState("");
  const [suiteId, setSuiteId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [urgency, setUrgency] = useState<"routine"|"soon"|"urgent"|"emergency">("soon");
  const [accessInfo, setAccessInfo] = useState("");
  const [permission, setPermission] = useState(true);
  const [accessTimes, setAccessTimes] = useState("");

  // Auto-select single company / suite
  useEffect(() => {
    if (ctx && ctx.companies.length === 1 && !tenantCompanyId) setTenantCompanyId(ctx.companies[0].id);
  }, [ctx, tenantCompanyId]);

  const availableSuites = useMemo(() => {
    if (!ctx || !tenantCompanyId) return [];
    const suiteIds = new Set(ctx.assignments.filter(a => a.tenant_company_id === tenantCompanyId).map(a => a.suite_id));
    return ctx.suites.filter(s => suiteIds.has(s.id));
  }, [ctx, tenantCompanyId]);

  useEffect(() => {
    if (availableSuites.length === 1 && !suiteId) setSuiteId(availableSuites[0].id);
  }, [availableSuites, suiteId]);

  const selectedSuite = availableSuites.find(s => s.id === suiteId);
  const propertyId = selectedSuite?.property_id;

  const mut = useMutation({
    mutationFn: () => createFn({ data: {
      property_id: propertyId!,
      suite_id: suiteId,
      tenant_company_id: tenantCompanyId,
      title, description, category,
      tenant_urgency: urgency,
      access_information: accessInfo,
      permission_to_enter: permission,
      preferred_access_times: accessTimes,
    }}),
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["requests"] });
      toast.success(`Request submitted: ${data.request_number}`);
      navigate({ to: "/requests/$id", params: { id: data.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId || !suiteId || !tenantCompanyId) return toast.error("Choose your property and suite");
    mut.mutate();
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <PageHeader title="New maintenance request" description="Give us as much detail as you can. Photos help us diagnose faster." />

      <div className="rounded-md border bg-destructive/10 border-destructive/40 p-4 mb-6 flex gap-3 text-sm">
        <TriangleAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div>
          <div className="font-medium text-destructive">Emergency? Call 911 first.</div>
          <div className="text-muted-foreground mt-1">
            For fires, gas leaks, active flooding, or any immediate threat to safety, contact 911 and Wilmington Fire &amp; Rescue before submitting a request. Then log it here so we can coordinate follow-up work.
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 md:p-6">
          <form onSubmit={submit} className="space-y-5">
            {ctx && ctx.companies.length > 1 && (
              <div className="space-y-2">
                <Label>Tenant company</Label>
                <Select value={tenantCompanyId} onValueChange={setTenantCompanyId}>
                  <SelectTrigger><SelectValue placeholder="Choose your company" /></SelectTrigger>
                  <SelectContent>{ctx.companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Suite</Label>
              {availableSuites.length === 1 ? (
                <div className="rounded-md border bg-muted px-3 py-2 text-sm">
                  {availableSuites[0].suite_number} — {availableSuites[0].property?.name}
                </div>
              ) : (
                <Select value={suiteId} onValueChange={setSuiteId}>
                  <SelectTrigger><SelectValue placeholder="Choose suite" /></SelectTrigger>
                  <SelectContent>
                    {availableSuites.map(s => <SelectItem key={s.id} value={s.id}>{s.suite_number} — {s.property?.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
                  <SelectContent>{categoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>How urgent is this?</Label>
                <Select value={urgency} onValueChange={(v) => setUrgency(v as typeof urgency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{urgencyOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Short title</Label>
              <Input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., HVAC not cooling in conference room" />
            </div>

            <div className="space-y-2">
              <Label>What's going on?</Label>
              <Textarea rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="When did it start? What have you already tried? Anyone else affected?" />
            </div>

            <div className="space-y-2">
              <Label>Access information</Label>
              <Textarea rows={2} value={accessInfo} onChange={e => setAccessInfo(e.target.value)} placeholder="Where to enter, keys/codes needed, who to check in with…" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border p-3 flex items-center justify-between">
                <div>
                  <Label className="text-sm">Permission to enter without me?</Label>
                  <div className="text-xs text-muted-foreground">Vendors can enter during business hours.</div>
                </div>
                <Switch checked={permission} onCheckedChange={setPermission} />
              </div>
              <div className="space-y-2">
                <Label>Preferred access times</Label>
                <Input value={accessTimes} onChange={e => setAccessTimes(e.target.value)} placeholder="e.g., Weekdays 8am – 5pm" />
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Photo upload will be enabled once storage is fully wired — for now, note relevant photos in the description and we'll follow up.
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => navigate({ to: "/requests" })}>Cancel</Button>
              <Button type="submit" disabled={mut.isPending}>{mut.isPending ? "Submitting…" : "Submit request"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
