import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const statusStyle: Record<string, string> = {
  submitted: "bg-info/15 text-info-foreground border-info/40",
  manager_review: "bg-info/15 text-info-foreground border-info/40",
  awaiting_information: "bg-warning/25 text-warning-foreground border-warning/50",
  estimating: "bg-info/15 text-info-foreground border-info/40",
  awaiting_owner_approval: "bg-warning/30 text-warning-foreground border-warning/60",
  owner_question: "bg-warning/25 text-warning-foreground border-warning/50",
  additional_estimate_requested: "bg-warning/25 text-warning-foreground border-warning/50",
  approved: "bg-success/20 text-success border-success/50",
  declined: "bg-destructive/15 text-destructive border-destructive/50",
  vendor_coordination: "bg-info/15 text-info-foreground border-info/40",
  scheduled: "bg-info/15 text-info-foreground border-info/40",
  in_progress: "bg-info/20 text-info-foreground border-info/50",
  work_completed: "bg-success/20 text-success border-success/50",
  invoice_pending: "bg-warning/25 text-warning-foreground border-warning/50",
  completed: "bg-success/25 text-success border-success/60",
  closed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize",
      statusStyle[status] ?? "bg-muted text-muted-foreground border-border"
    )}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const urgencyStyle: Record<string, string> = {
  routine: "bg-muted text-muted-foreground border-border",
  soon: "bg-info/15 text-info-foreground border-info/40",
  urgent: "bg-warning/30 text-warning-foreground border-warning/60",
  emergency: "bg-destructive/20 text-destructive border-destructive/60",
};

export function UrgencyBadge({ urgency }: { urgency: string | null | undefined }) {
  if (!urgency) return null;
  return (
    <span className={cn(
      "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize",
      urgencyStyle[urgency] ?? "bg-muted text-muted-foreground border-border"
    )}>
      {urgency}
    </span>
  );
}

export function StatCard({ label, value, hint, tone, to, search }: { label: string; value: ReactNode; hint?: string; tone?: "default" | "warning" | "urgent" | "success"; to?: string; search?: Record<string, string> }) {
  const toneCls = tone === "urgent" ? "border-destructive/40"
    : tone === "warning" ? "border-warning/50"
    : tone === "success" ? "border-success/50"
    : "border-border";
  const inner = (
    <div className={cn("rounded-lg border bg-card p-4 h-full", toneCls, to && "hover:border-primary/60 hover:shadow-sm transition-colors cursor-pointer")}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
  if (to) return <Link to={to as never} search={search as never} className="block">{inner}</Link>;
  return inner;
}

export function money(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n));
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
