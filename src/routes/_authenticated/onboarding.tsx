import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe, setDemoRole } from "@/lib/rpm.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, ShieldCheck, Wrench, User } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/rpm-ui";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Choose your role — C Street Management" }] }),
  component: OnboardingPage,
});

const roleOptions = [
  {
    role: "property_manager" as const, label: "Property Manager", icon: Wrench,
    description: "Review and triage requests, coordinate vendors, request owner approvals, and track completion. Assigned to both Wilmington properties.",
  },
  {
    role: "owner" as const, label: "Property Owner", icon: Building,
    description: "See pending approvals grouped by property, approve/decline work, and review estimated-vs-final costs. Linked to Riverfront Holdings LLC.",
  },
  {
    role: "tenant" as const, label: "Commercial Tenant", icon: User,
    description: "Submit maintenance requests, upload photos, and track the status of your suite's open work. Linked to Cape Fear Legal Group.",
  },
  {
    role: "admin" as const, label: "Admin", icon: ShieldCheck,
    description: "Full access across the organization — everything a property manager can do, plus role administration.",
  },
];

function OnboardingPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const getMeFn = useServerFn(getMe);
  const setRoleFn = useServerFn(setDemoRole);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });
  const current = me?.roles?.[0];

  const mut = useMutation({
    mutationFn: (role: "admin" | "property_manager" | "owner" | "tenant") =>
      setRoleFn({ data: { role } }),
    onSuccess: async () => {
      await qc.invalidateQueries();
      toast.success("Role updated");
      navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 max-w-5xl">
      <PageHeader
        title="Choose your demo role"
        description="This one-property Wilmington demo lets you explore the app from any perspective. Switch anytime from the sidebar."
      />
      {current && (
        <div className="mb-4 rounded-md border bg-panel p-3 text-sm">
          Current role: <span className="font-medium capitalize">{current.replace("_", " ")}</span>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {roleOptions.map(opt => {
          const Icon = opt.icon;
          const active = current === opt.role;
          return (
            <Card key={opt.role} className={active ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{opt.label}</CardTitle>
                    <CardDescription>{active ? "Active role" : "Switch to this role"}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{opt.description}</p>
                <Button
                  onClick={() => mut.mutate(opt.role)}
                  disabled={mut.isPending}
                  variant={active ? "outline" : "default"}
                  size="sm"
                >
                  {active ? "Keep this role" : `Continue as ${opt.label}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
