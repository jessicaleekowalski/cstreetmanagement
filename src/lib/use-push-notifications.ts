import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { savePushSubscription, deletePushSubscription } from "@/lib/push.functions";

// Base64URL VAPID key — safe to ship in client code, this is the *public* key.
export const VAPID_PUBLIC_KEY =
  "BDKaQ9LJBKJncVr9tEQGY3LBptPtrucpDVkCssdr2mIGdvDLIRNpBCMZWJfA8Uu2761bDrNS9chNgPr-DrhhMUg";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type PushStatus =
  | { supported: false; reason: string }
  | { supported: true; permission: NotificationPermission; subscribed: boolean };

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>({ supported: false, reason: "loading" });
  const [busy, setBusy] = useState(false);
  const saveFn = useServerFn(savePushSubscription);
  const deleteFn = useServerFn(deletePushSubscription);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setStatus({ supported: false, reason: "Your browser does not support push notifications." });
      return;
    }
    if (!window.isSecureContext) {
      setStatus({ supported: false, reason: "Push notifications require HTTPS." });
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setStatus({ supported: true, permission: Notification.permission, subscribed: !!sub });
    } catch {
      setStatus({ supported: true, permission: Notification.permission, subscribed: false });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!status.supported) return;
    setBusy(true);
    try {
      let reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (!reg) reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus({ supported: true, permission: perm, subscribed: false });
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const endpoint = json.endpoint ?? sub.endpoint;
      const p256dh = json.keys?.p256dh ?? bufToBase64Url(sub.getKey("p256dh"));
      const auth = json.keys?.auth ?? bufToBase64Url(sub.getKey("auth"));
      await saveFn({
        data: {
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.slice(0, 500),
        },
      });
      setStatus({ supported: true, permission: "granted", subscribed: true });
    } finally {
      setBusy(false);
    }
  }, [status.supported, saveFn]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        try {
          await deleteFn({ data: { endpoint } });
        } catch { /* ignore */ }
      }
      setStatus((prev) =>
        prev.supported
          ? { supported: true, permission: prev.permission, subscribed: false }
          : prev,
      );
    } finally {
      setBusy(false);
    }
  }, [deleteFn]);

  return { status, busy, enable, disable, refresh };
}
