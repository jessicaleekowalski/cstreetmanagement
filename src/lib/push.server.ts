import { buildPushPayload, type PushMessage, type PushSubscription, type VapidKeys } from "@block65/webcrypto-web-push";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function getVapid(): VapidKeys & { subject: string } {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:notifications@example.com";
  if (!publicKey || !privateKey) throw new Error("VAPID keys are not configured");
  return { publicKey, privateKey, subject };
}

/**
 * Send a push notification to every subscription owned by the given user ids.
 * Silently prunes subscriptions that return 404/410 (endpoint expired).
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return;
  const uniqueUserIds = Array.from(new Set(userIds));
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", uniqueUserIds);
  if (error) {
    console.error("[push] failed to load subscriptions", error.message);
    return;
  }
  if (!subs || subs.length === 0) return;

  const vapid = getVapid();
  const message: PushMessage = {
    data: JSON.stringify(payload),
    options: { ttl: 60 * 60 * 24 }, // 1 day
  };

  const expired: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      const subscription: PushSubscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
        expirationTime: null,
      };
      try {
        const req = await buildPushPayload(message, subscription, vapid);
        const res = await fetch(s.endpoint, req);
        if (res.status === 404 || res.status === 410) {
          expired.push(s.id);
        } else if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.warn(`[push] delivery ${res.status}: ${text.slice(0, 200)}`);
        }
      } catch (err) {
        console.warn("[push] send failed", err instanceof Error ? err.message : err);
      }
    }),
  );

  if (expired.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", expired);
  }
}

/** Get user_ids of property managers assigned to a property. */
export async function getManagerUserIds(propertyId: string): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("property_manager_assignments")
    .select("manager_user_id")
    .eq("property_id", propertyId);
  return (data ?? []).map((r) => r.manager_user_id as string);
}

/** Get user_ids of owners (owner_entity_users) for a property. */
export async function getOwnerUserIds(propertyId: string): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: prop } = await supabaseAdmin
    .from("properties")
    .select("owner_entity_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (!prop?.owner_entity_id) return [];
  const { data } = await supabaseAdmin
    .from("owner_entity_users")
    .select("user_id")
    .eq("owner_entity_id", prop.owner_entity_id);
  return (data ?? []).map((r) => r.user_id as string);
}
