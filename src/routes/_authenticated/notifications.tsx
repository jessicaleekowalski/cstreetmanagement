import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listNotifications } from "@/lib/rpm.functions";
import { PageHeader } from "@/components/rpm-ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { PushToggle } from "@/components/push-toggle";
import { usePushNotifications } from "@/lib/use-push-notifications";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — C-Street Management Group" }] }),
  component: NotificationsPage,
});
function NotificationsPage() {
  const fn = useServerFn(listNotifications);
  const { data = [] } = useQuery({ queryKey: ["notifications"], queryFn: () => fn() });
  const { status } = usePushNotifications();
  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Notifications" />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Push notifications</CardTitle>
          <CardDescription>
            Get alerts for new maintenance requests, approvals needed, status changes, and new invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <PushToggle />
          {!status.supported && (
            <p className="text-xs text-muted-foreground">
              {status.reason} Push notifications require HTTPS and don't run inside the Lovable editor preview — open your published site (or install it to your home screen on iPhone) to enable them.
            </p>
          )}
        </CardContent>
      </Card>

      {data.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
          <Bell className="h-6 w-6 mx-auto mb-2" />
          You're all caught up.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {data.map(n => (
            <Card key={n.id}><CardContent className="p-3 text-sm">
              <div className="font-medium">{n.title}</div>
              {n.body && <div className="text-muted-foreground text-xs mt-1">{n.body}</div>}
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}
