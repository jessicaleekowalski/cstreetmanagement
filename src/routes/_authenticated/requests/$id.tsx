import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRequest, getMe, decideApproval, listVendors, createEstimate, getAttachmentUrl } from "@/lib/rpm.functions";
import { PageHeader, StatusBadge, UrgencyBadge, money } from "@/components/rpm-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Paperclip, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/requests/$id")({
  head: () => ({ meta: [{ title: "Request detail — C Street Management" }] }),
  component: RequestDetailPage,
});

function RequestDetailPage() {
  const { id } = useParams({ from: "/_authenticated/requests/$id" });
  const getReqFn = useServerFn(getRequest);
  const getMeFn = useServerFn(getMe);
  const { data, isLoading } = useQuery({ queryKey: ["request", id], queryFn: () => getReqFn({ data: { id } }) });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });

  if (isLoading) return <div className="p-6 text-muted-foreground text-sm">Loading…</div>;
  if (!data) return <div className="p-6 text-muted-foreground text-sm">Request not found.</div>;

  const roles = me?.roles ?? [];
  const isTenant = roles.includes("tenant") && !roles.includes("property_manager") && !roles.includes("admin");
  const isOwner = roles.includes("owner") && !roles.includes("property_manager") && !roles.includes("admin");
  const isManager = roles.includes("property_manager") || roles.includes("admin");

  const r = data.request;
  const pending = data.approvals.find(a => a.decision === "pending");

  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-6">
      <PageHeader
        title={r.title}
        description={`${r.property?.name} · ${r.suite?.suite_number ?? "—"} · ${r.tenant_company?.name ?? ""}`}
        actions={<div className="flex items-center gap-2"><span className="text-xs font-mono text-muted-foreground">{r.request_number}</span><StatusBadge status={r.status} /></div>}
      />

      <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Metric label="Urgency"><UrgencyBadge urgency={r.manager_urgency ?? r.tenant_urgency} /></Metric>
        <Metric label="Responsibility"><span className="capitalize">{r.responsibility ?? "—"}</span></Metric>
        {!isTenant && <Metric label="Estimated" value={money(r.estimated_cost)} />}
        {!isTenant && <Metric label="Approved" value={money(r.approved_amount)} />}
        <Metric label="Final cost" value={money(r.final_cost)} />
        <Metric label="Submitted" value={r.submitted_at ? format(new Date(r.submitted_at), "MMM d, yyyy") : "—"} />
        {r.scheduled_date && <Metric label="Scheduled" value={format(new Date(r.scheduled_date), "MMM d, yyyy")} />}
        {r.completed_at && <Metric label="Completed" value={format(new Date(r.completed_at), "MMM d, yyyy")} />}
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Tenant-submitted details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label="Category" value={r.category ?? "—"} />
              <Field label="Description" value={r.description ?? "—"} multiline />
              <Field label="Access info" value={r.access_information ?? "—"} multiline />
              <Field label="Preferred access times" value={r.preferred_access_times ?? "—"} />
              <Field label="Permission to enter" value={r.permission_to_enter ? "Yes" : "No"} />
            </CardContent>
          </Card>

          {!isTenant && (
            <Card>
              <CardHeader><CardTitle className="text-base">Manager review</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Field label="Manager urgency"><UrgencyBadge urgency={r.manager_urgency} /></Field>
                <Field label="Responsibility notes" value={r.responsibility_notes ?? "—"} multiline />
                <Field label="Recommended action" value={r.recommended_action ?? "—"} multiline />
                <Field label="Assigned vendor" value={r.assigned_vendor?.name ?? "—"} />
              </CardContent>
            </Card>
          )}

          {!isTenant && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estimates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.estimates.length === 0 && (
                  <div className="text-xs text-muted-foreground">No estimates yet.</div>
                )}
                {data.estimates.map(e => (
                  <EstimateRow key={e.id} estimate={e} />
                ))}
                {isManager && <AddEstimateForm requestId={r.id} />}
              </CardContent>
            </Card>
          )}

          {!isTenant && data.approvals.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Approval history</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {data.approvals.map(a => (
                  <div key={a.id} className="border-l-2 border-border pl-3 text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">{format(new Date(a.requested_at), "MMM d, yyyy")}</span>
                      <StatusBadge status={a.decision} />
                    </div>
                    {a.recommended_amount && <div className="text-xs">Recommended amount: <span className="font-medium">{money(a.recommended_amount)}</span></div>}
                    {a.manager_message && <div className="text-xs text-muted-foreground">Manager: {a.manager_message}</div>}
                    {a.decision_message && <div className="text-xs">Owner: {a.decision_message}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {isOwner && pending && <OwnerApprovalPanel approvalId={pending.id} recommendedAmount={pending.recommended_amount} />}

          {!isTenant && data.financialImpact.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Financial-impact notes</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.financialImpact.map(f => (
                  <div key={f.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        {f.category.replace(/_/g," ")} · {f.timeframe.replace(/_/g," ")}
                      </div>
                      {f.amount && <div className="text-sm font-semibold">{money(f.amount)}</div>}
                    </div>
                    <div className="mt-1">{f.note}</div>
                    {!f.owner_visible && <div className="text-[10px] uppercase tracking-wider text-warning-foreground mt-1">Internal only</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {data.completion.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Completion</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.completion.map(c => (
                  <div key={c.id} className="space-y-1">
                    <Field label="Vendor" value={c.vendor?.name ?? "—"} />
                    <Field label="Completed" value={c.completed_on ? format(new Date(c.completed_on), "MMM d, yyyy") : "—"} />
                    <Field label="Final cost" value={money(c.final_cost)} />
                    <Field label="Invoice #" value={c.invoice_number ?? "—"} />
                    <Field label="Warranty" value={c.warranty_details ?? "—"} multiline />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Activity timeline</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs">
              <TimelineItem date={r.submitted_at} label="Submitted" />
              {data.estimates[0] && <TimelineItem date={data.estimates[0].received_at} label="First estimate received" />}
              {data.approvals[0] && <TimelineItem date={data.approvals[0].requested_at} label="Approval requested" />}
              {data.approvals.filter(a => a.decided_at).map(a => (
                <TimelineItem key={a.id} date={a.decided_at} label={`Owner: ${a.decision.replace(/_/g," ")}`} />
              ))}
              {r.scheduled_date && <TimelineItem date={r.scheduled_date} label="Scheduled" />}
              {r.completed_at && <TimelineItem date={r.completed_at} label="Work completed" />}
            </CardContent>
          </Card>

          {isManager && (
            <Card>
              <CardHeader><CardTitle className="text-base">Manager actions</CardTitle></CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Full edit UI (advance status, upload estimates, add financial-impact notes, record completion) is scaffolded in the schema and coming in the next pass.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, children }: { label: string; value?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{children ?? value}</div>
    </div>
  );
}
function Field({ label, value, multiline, children }: { label: string; value?: React.ReactNode; multiline?: boolean; children?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground pt-0.5">{label}</div>
      <div className={"col-span-2 " + (multiline ? "whitespace-pre-wrap" : "")}>{children ?? value}</div>
    </div>
  );
}
function TimelineItem({ date, label }: { date: string | null | undefined; label: string }) {
  if (!date) return null;
  return (
    <div className="flex gap-3">
      <div className="w-16 shrink-0 text-muted-foreground">{format(new Date(date), "MMM d")}</div>
      <div>{label}</div>
    </div>
  );
}

function OwnerApprovalPanel({ approvalId, recommendedAmount }: { approvalId: string; recommendedAmount: number | null }) {
  const qc = useQueryClient();
  const decideFn = useServerFn(decideApproval);
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<null | "approved" | "declined" | "additional_estimate_requested" | "question">(null);

  const mut = useMutation({
    mutationFn: (decision: "approved" | "declined" | "additional_estimate_requested" | "question") =>
      decideFn({ data: { approval_id: approvalId, decision, message } }),
    onSuccess: async () => {
      await qc.invalidateQueries();
      toast.success("Decision recorded");
      setMessage("");
      setPendingAction(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actionLabels: Record<string, string> = {
    approved: "Approve",
    declined: "Decline",
    additional_estimate_requested: "Request another estimate",
    question: "Ask a question",
  };

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader><CardTitle className="text-base">Your decision</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          Recommended amount: <span className="font-semibold">{money(recommendedAmount)}</span>
        </div>
        <Textarea placeholder="Optional message to your property manager…" value={message} onChange={e => setMessage(e.target.value)} rows={3} />
        <div className="flex flex-wrap gap-2">
          {(["approved","declined","additional_estimate_requested","question"] as const).map(action => (
            <AlertDialog key={action} open={pendingAction === action} onOpenChange={o => setPendingAction(o ? action : null)}>
              <AlertDialogTrigger asChild>
                <Button
                  variant={action === "approved" ? "default" : action === "declined" ? "destructive" : "outline"}
                  size="sm"
                >
                  {actionLabels[action]}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm: {actionLabels[action]}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {action === "approved" && `You're approving ${money(recommendedAmount)} of work. Your property manager will proceed with vendor coordination.`}
                    {action === "declined" && `You're declining this work. Your manager will be notified.`}
                    {action === "additional_estimate_requested" && `Your manager will collect another estimate.`}
                    {action === "question" && `Your message will be sent to your property manager.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => mut.mutate(action)} disabled={mut.isPending}>
                    Confirm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
