// Cloudflare Pages Function — POST /api/chat-customer-send
// Body: { token, message }
// Public endpoint (no login) — portal_token is an unguessable UUID acting
// as the key, same pattern as customer-portal.js. This is the ONLY way a
// customer can insert a chat message — there is no direct client-side
// Supabase access for customers (see migration_fasa51_chat.sql for why).
//
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, plus whatever
// _send-push-to-owner.js needs for Web Push.

import { sendPushToOwner } from "./_send-push-to-owner.js";

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

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Permintaan tidak sah." }, 400);
  }
  const { token, message } = body;
  if (!token || !message || !message.trim()) return json({ error: "Token dan mesej diperlukan." }, 400);
  if (message.length > 2000) return json({ error: "Mesej terlalu panjang." }, 400);

  const customers = await sbAdmin(env, `/customers?portal_token=eq.${token}&select=id,owner_id,name`);
  if (customers.length === 0) return json({ error: "Token tidak sah." }, 404);
  const customer = customers[0];

  const [inserted] = await sbAdmin(env, "/chat_messages", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify({
      customer_id: customer.id,
      owner_id: customer.owner_id,
      sender_type: "customer",
      message_text: message.trim(),
    }),
  });

  // Best-effort push to owner — never block the customer's send on this.
  try {
    await sendPushToOwner(env, customer.owner_id, {
      title: `Mesej baharu dari ${customer.name}`,
      body: message.trim().slice(0, 100),
      url: "/dashboard.html?page=pelanggan-list",
      tag: "chat-message",
    });
  } catch (err) {
    console.error("Push notification failed:", err.message);
  }

  return json({ message: inserted });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
