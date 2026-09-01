// Cloudflare Pages Function — POST/DELETE /api/save-push-subscription
// Called by dashboard.html when the owner enables/disables push notifications.
//
// Required Pages env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

async function getUserFromToken(env, accessToken) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function sbAdmin(env, path, options = {}) {
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
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization") || "";
  const accessToken = authHeader.replace("Bearer ", "");
  const user = await getUserFromToken(env, accessToken);
  if (!user) return json({ error: "Tidak sah" }, 401);

  const { subscription } = await request.json();
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return json({ error: "Subscription tidak lengkap" }, 400);
  }

  await sbAdmin(env, "/push_subscriptions", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify({
      owner_id: user.id,
      endpoint: subscription.endpoint,
      p256dh_key: subscription.keys.p256dh,
      auth_key: subscription.keys.auth,
    }),
  });

  return json({ success: true });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization") || "";
  const accessToken = authHeader.replace("Bearer ", "");
  const user = await getUserFromToken(env, accessToken);
  if (!user) return json({ error: "Tidak sah" }, 401);

  const { endpoint } = await request.json();
  if (!endpoint) return json({ error: "Endpoint diperlukan" }, 400);

  await sbAdmin(env, `/push_subscriptions?owner_id=eq.${user.id}&endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: "DELETE",
    prefer: "return=minimal",
  });

  return json({ success: true });
}
