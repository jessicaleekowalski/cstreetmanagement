import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProperties } from "@/lib/rpm.functions";
import { PageHeader } from "@/components/rpm-ui";
import { Card, CardContent } from "@/components/ui/card";
import { Building } from "lucide-react";

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({ meta: [{ title: "Properties — C-Street Management Group" }] }),
  component: PropertiesPage,
});

function PropertiesPage() {
  const fn = useServerFn(listProperties);
  const { data = [] } = useQuery({ queryKey: ["properties"], queryFn: () => fn() });
  return (
    <div className="p-6">
      <PageHeader title="Properties" description="Commercial properties in your portfolio." />
      <div className="grid gap-4 md:grid-cols-2">
        {data.map(p => (
          <Card key={p.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Building className="h-4 w-4" /></div>
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.address_line1}, {p.city}, {p.state} {p.postal_code}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t">
                <Field label="Owner" value={p.owner_entity?.name} />
                <Field label="Type" value={p.property_type} />
                <Field label="Sq ft" value={p.square_feet?.toLocaleString()} />
                <Field label="Year built" value={p.year_built} />
                <Field label="Suites" value={p.suites?.length} />
              </div>
              {p.notes && <div className="text-xs text-muted-foreground pt-2">{p.notes}</div>}
            </CardContent>
          </Card>
        ))}
        {data.length === 0 && <div className="text-sm text-muted-foreground">No properties visible with your current role.</div>}
      </div>
    </div>
  );
}
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div><div>{value ?? "—"}</div></div>;
}
