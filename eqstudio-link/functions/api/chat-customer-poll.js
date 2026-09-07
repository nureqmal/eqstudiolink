// Cloudflare Pages Function — GET /api/chat-customer-poll?token=<uuid>&since=<iso-timestamp>
// Public endpoint (no login) — same portal_token pattern as customer-portal.js.
// Called every few seconds by portal.html for near-real-time chat without
// needing a direct (and privacy-risky) client-side Supabase Realtime
// subscription for anonymous customers.
//
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

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
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status}`);
  return res.status === 204 ? null : res.json();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const since = url.searchParams.get("since"); // ISO timestamp, optional
  if (!token) return json({ error: "Token diperlukan." }, 400);

  const customers = await sbAdmin(env, `/customers?portal_token=eq.${token}&select=id`);
  if (customers.length === 0) return json({ error: "Token tidak sah." }, 404);
  const customerId = customers[0].id;

  const sinceFilter = since ? `&created_at=gt.${encodeURIComponent(since)}` : "";
  const messages = await sbAdmin(
    env,
    `/chat_messages?customer_id=eq.${customerId}&select=id,sender_type,message_text,created_at${sinceFilter}&order=created_at.asc`,
    { prefer: "return=representation" }
  );

  // Mark any owner messages as read-by-customer, since they're now polling
  // (i.e. actively viewing the conversation).
  const unreadOwnerIds = messages.filter(m => m.sender_type === "owner").map(m => m.id);
  if (unreadOwnerIds.length > 0) {
    await sbAdmin(env, `/chat_messages?id=in.(${unreadOwnerIds.join(",")})`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({ read_by_customer: true }),
    });
  }

  return json({ messages });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
