import webpush from "web-push";
import { SupabaseClient } from "@supabase/supabase-js";

let configured = false;

/** Configures the web-push library with this app's VAPID keys, once. */
function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:owner@yngaestheticslounge.com",
    publicKey,
    privateKey
  );
  configured = true;
  return true;
}

/**
 * Sends a web push notification to every device a set of employees have
 * subscribed on (they may have none, e.g. haven't installed the app or
 * granted permission yet — that's fine, this is best-effort and additive to
 * the in-app notification bell, never a replacement for it).
 *
 * Any subscription the push service reports as gone (404/410 — the device
 * unsubscribed, cleared data, or uninstalled the app) is deleted so we stop
 * wasting sends on it.
 */
export async function sendPushToEmployees(
  supabase: SupabaseClient,
  employeeIds: string[],
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  if (employeeIds.length === 0) return;
  if (!ensureConfigured()) return; // VAPID keys not set up yet — skip silently

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("employee_id", employeeIds);
  if (!subs || subs.length === 0) return;

  const json = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/dashboard",
  });

  const staleIds: string[] = [];
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          json
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) staleIds.push(sub.id);
        // Other errors (network blip, etc.) are swallowed — best-effort.
      }
    })
  );

  if (staleIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", staleIds);
  }
}
