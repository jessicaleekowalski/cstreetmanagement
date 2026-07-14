import { Bell, BellOff } from "lucide-react";
import { usePushNotifications } from "@/lib/use-push-notifications";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function PushToggle({ compact }: { compact?: boolean }) {
  const { status, busy, enable, disable } = usePushNotifications();

  if (!status.supported) {
    if (compact) {
      return (
        <Button size="sm" variant="ghost" disabled aria-label={status.reason} title={status.reason}>
          <BellOff className="h-4 w-4 opacity-60" />
        </Button>
      );
    }
    return (
      <div className="text-[10px] text-sidebar-foreground/50 px-1 leading-snug">
        {status.reason}
      </div>
    );
  }

  const denied = status.permission === "denied";
  const on = status.subscribed && status.permission === "granted";

  const handle = async () => {
    if (denied) {
      toast.error("Notifications blocked", {
        description: "Enable notifications for this site in your browser settings, then try again.",
      });
      return;
    }
    try {
      if (on) {
        await disable();
        toast.success("Push notifications turned off");
      } else {
        await enable();
        toast.success("Push notifications enabled", {
          description: "You'll get alerts for new requests, approvals, invoices, and status changes.",
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update notifications");
    }
  };

  const Icon = on ? Bell : BellOff;
  if (compact) {
    return (
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={handle}
        aria-label={denied ? "Notifications blocked" : on ? "Notifications on" : "Enable notifications"}
        title={denied ? "Notifications blocked" : on ? "Notifications on" : "Enable notifications"}
      >
        <Icon className="h-4 w-4" />
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={handle}
      className={cn(
        "w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        on && "text-sidebar-accent-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5 mr-2" />
      {denied ? "Notifications blocked" : on ? "Notifications on" : "Enable notifications"}
    </Button>
  );
}
