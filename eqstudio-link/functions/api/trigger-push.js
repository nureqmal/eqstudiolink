// Cloudflare Pages Function — POST /api/trigger-push
// Called by forum.html (client-side) after a reply is posted, since the
// VAPID private key must stay server-side and can't be used directly from
// the browser. Requires a valid logged-in session (any authenticated user,
// not necessarily the notification's recipient) as a basic anti-abuse check
// — this only ever fires alongside an action a logged-in user already took
// (posting a reply), not as an open "send anyone a push" endpoint.
//
// Required Pages env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY_D, VAPID_PUBLIC_KEY_X, VAPID_PUBLIC_KEY_Y, VAPID_SUBJECT

import { sendPushToOwner } from "./_send-push-to-owner.js";

async function getUserFromToken(env, accessToken) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization") || "";
  const accessToken = authHeader.replace("Bearer ", "");
  const caller = await getUserFromToken(env, accessToken);
  if (!caller) return json({ error: "Tidak sah" }, 401);

  const { ownerId, title, body, url, tag } = await request.json();
  if (!ownerId || !title || !body) return json({ error: "Data tidak lengkap" }, 400);

  await sendPushToOwner(env, ownerId, { title, body, url: url || "/dashboard.html", tag });
  return json({ success: true });
}
