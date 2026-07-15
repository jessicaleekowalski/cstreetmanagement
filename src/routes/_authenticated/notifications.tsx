import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listNotifications } from "@/lib/rpm.functions";
import { sendTestPush } from "@/lib/push.functions";
import { PageHeader } from "@/components/rpm-ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { PushToggle } from "@/components/push-toggle";
import { usePushNotifications } from "@/lib/use-push-notifications";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — C-Street Management Group" }] }),
  component: NotificationsPage,
});
function NotificationsPage() {
  const fn = useServerFn(listNotifications);
  const testFn = useServerFn(sendTestPush);
  const { data = [] } = useQuery({ queryKey: ["notifications"], queryFn: () => fn() });
  const { status } = usePushNotifications();
  const [sending, setSending] = useState(false);

  const handleTest = async () => {
    setSending(true);
    try {
      await testFn();
      toast.success("Test notification sent", { description: "Check your device — it may take a few seconds." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send test notification");
    } finally {
      setSending(false);
    }
  };

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
        <CardContent className="space-y-3">
          <PushToggle />
          <Button size="sm" variant="outline" onClick={handleTest} disabled={sending}>
            {sending ? "Sending…" : "Send test notification"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Status: supported={String(status.supported)} · permission={status.permission} · subscribed={String(status.subscribed)}
            {status.reason ? ` · ${status.reason}` : ""}
          </p>
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
