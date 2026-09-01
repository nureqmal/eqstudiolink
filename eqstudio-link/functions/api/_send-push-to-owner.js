// _send-push-to-owner.js — shared helper, called from any Function that
// already creates an in-app notification (booking-create, booking-customer-
// action, forum reply) so the SAME event also triggers a phone push.
// Best-effort: a push failure never blocks the action that triggered it.

import { sendWebPush } from "./_web-push-lib.js";

async function sbAdminInternal(env, path, options = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status}`);
  return res.status === 204 ? null : res.json();
}

export async function sendPushToOwner(env, ownerId, { title, body, url, tag }) {
  if (!env.VAPID_PRIVATE_KEY_D || !env.VAPID_PUBLIC_KEY) return; // push not configured yet
  try {
    const subs = await sbAdminInternal(env, `/push_subscriptions?owner_id=eq.${ownerId}&select=id,endpoint,p256dh_key,auth_key`);
    if (!subs || subs.length === 0) return;

    const vapid = {
      subject: env.VAPID_SUBJECT || "mailto:hello@eqstudio.link",
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKeyJwk: { d: env.VAPID_PRIVATE_KEY_D, x: env.VAPID_PUBLIC_KEY_X, y: env.VAPID_PUBLIC_KEY_Y },
    };

    await Promise.all(subs.map(async (sub) => {
      try {
        const result = await sendWebPush(sub, { title, body, url, tag }, vapid);
        if (result.expired) {
          await sbAdminInternal(env, `/push_subscriptions?id=eq.${sub.id}`, { method: "DELETE", prefer: "return=minimal" });
        }
      } catch (err) {
        console.error("sendPushToOwner: one subscription failed", err.message);
      }
    }));
  } catch (err) {
    console.error("sendPushToOwner failed:", err.message);
  }
}
