import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listVendors } from "@/lib/rpm.functions";
import { PageHeader } from "@/components/rpm-ui";

export const Route = createFileRoute("/_authenticated/vendors")({
  head: () => ({ meta: [{ title: "Vendors — C Street Management Group" }] }),
  component: VendorsPage,
});

function VendorsPage() {
  const fn = useServerFn(listVendors);
  const { data = [] } = useQuery({ queryKey: ["vendors"], queryFn: () => fn() });
  return (
    <div className="p-6">
      <PageHeader title="Vendors" description="Assigned to maintenance requests by property managers. Vendors don't log in — they're contacted externally." />
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Name</th>
              <th className="text-left px-3 py-2 font-medium">Trade</th>
              <th className="text-left px-3 py-2 font-medium">Contact</th>
              <th className="text-left px-3 py-2 font-medium">Phone</th>
              <th className="text-left px-3 py-2 font-medium">License</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map(v => (
              <tr key={v.id}>
                <td className="px-3 py-2 font-medium">{v.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{v.trade}</td>
                <td className="px-3 py-2 text-muted-foreground">{v.contact_name}</td>
                <td className="px-3 py-2 text-muted-foreground">{v.contact_phone}</td>
                <td className="px-3 py-2 text-muted-foreground">{v.license_number}</td>
                <td className="px-3 py-2">{v.active ? "Active" : "Inactive"}</td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-8">No vendors visible with your current role.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
