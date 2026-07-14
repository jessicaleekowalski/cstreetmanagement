import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRequests, getMe } from "@/lib/rpm.functions";
import { PageHeader, StatusBadge, UrgencyBadge, money } from "@/components/rpm-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { PlusCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/requests/")({
  head: () => ({ meta: [{ title: "Maintenance Requests — C-Street Management Group" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    status: typeof s.status === "string" ? s.status : undefined,
    urgency: typeof s.urgency === "string" ? s.urgency : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  component: RequestsIndex,
});

function RequestsIndex() {
  const listFn = useServerFn(listRequests);
  const meFn = useServerFn(getMe);
  const { data: requests = [] } = useQuery({ queryKey: ["requests"], queryFn: () => listFn() });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const isTenant = me?.roles?.includes("tenant");

  const sp = Route.useSearch();
  const [q, setQ] = useState(sp.q ?? "");
  const [status, setStatus] = useState<string>(sp.status ?? "all");
  const [urgency, setUrgency] = useState<string>(sp.urgency ?? "all");

  const filtered = useMemo(() => {
    return requests.filter(r => {
      if (status !== "all" && r.status !== status) return false;
      if (urgency !== "all" && r.manager_urgency !== urgency && r.tenant_urgency !== urgency) return false;
      if (q) {
        const hay = `${r.request_number} ${r.title} ${r.property?.name ?? ""} ${r.suite?.suite_number ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [requests, q, status, urgency]);

  return (
    <div className="p-6">
      <PageHeader
        title={isTenant ? "My requests" : "Maintenance requests"}
        description={isTenant ? "Your submitted issues, in progress work, and history." : "Filter and search all requests across your managed properties."}
        actions={isTenant ? (
          <Link to="/requests/new"><Button><PlusCircle className="h-4 w-4 mr-2" /> New request</Button></Link>
        ) : undefined}
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <Input placeholder="Search request # or title…" value={q} onChange={e => setQ(e.target.value)} className="w-64" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["submitted","manager_review","awaiting_information","estimating","awaiting_owner_approval","approved","scheduled","in_progress","work_completed","completed","cancelled"].map(s => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={urgency} onValueChange={setUrgency}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Urgency" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All urgency</SelectItem>
            {["routine","soon","urgent","emergency"].map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              <th className="text-right px-3 py-2 font-medium">Final</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-muted/40">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link to="/requests/$id" params={{ id: r.id }} className="text-primary hover:underline">{r.request_number}</Link>
                </td>
                <td className="px-3 py-2">{r.title}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.property?.name} · {r.suite?.suite_number ?? "—"}</td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2"><UrgencyBadge urgency={r.manager_urgency ?? r.tenant_urgency} /></td>
                <td className="px-3 py-2 text-right">{money(r.estimated_cost)}</td>
                <td className="px-3 py-2 text-right">{money(r.final_cost)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center text-muted-foreground py-8">No requests match your filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
