// Cloudflare Pages Function — POST /api/chat-notify-customer
// Body: { customer_id }
// Called by dashboard.html right after an owner sends a chat message
// (which is inserted directly via the authenticated Supabase client).
// This Function only handles the THROTTLED EMAIL side — it does not
// insert the message itself.
//
// Throttling: at most one email per customer every 30 minutes, no matter
// how many messages the owner sends in that window. This protects Resend's
// free-tier 100/day cap, since it's shared with booking confirmations and
// reminders which matter more operationally.
//
// Abuse guard: only sends if there's actually an unread owner message for
// this customer — so this endpoint can't be used to spam arbitrary emails.
//
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
// RESEND_FROM_EMAIL, PUBLIC_SITE_URL

const THROTTLE_MINUTES = 30;

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
  const { customer_id } = body;
  if (!customer_id) return json({ error: "customer_id diperlukan." }, 400);

  const customers = await sbAdmin(env, `/customers?id=eq.${customer_id}&select=id,name,contact_email,portal_token,owner_id,chat_last_emailed_at,preferred_language`);
  if (customers.length === 0) return json({ error: "Pelanggan tidak dijumpai." }, 404);
  const customer = customers[0];
  if (!customer.contact_email) return json({ skipped: "no_email" });

  // Abuse guard: only proceed if there's an actual unread owner message.
  const unread = await sbAdmin(env, `/chat_messages?customer_id=eq.${customer_id}&sender_type=eq.owner&read_by_customer=eq.false&select=id&limit=1`);
  if (unread.length === 0) return json({ skipped: "no_unread" });

  // Throttle: skip if we already emailed this customer recently.
  if (customer.chat_last_emailed_at) {
    const minutesSince = (Date.now() - new Date(customer.chat_last_emailed_at).getTime()) / 60000;
    if (minutesSince < THROTTLE_MINUTES) return json({ skipped: "throttled" });
  }

  const profiles = await sbAdmin(env, `/profiles?id=eq.${customer.owner_id}&select=business_name`);
  const bizName = profiles[0]?.business_name || "Perniagaan";
  const portalUrl = `${env.PUBLIC_SITE_URL || "https://eqstudio.link"}/portal.html?token=${customer.portal_token}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: customer.contact_email,
      subject: `Mesej baharu daripada ${bizName}`,
      html: `<p>Salam ${customer.name},</p><p>${bizName} telah hantar mesej baharu kepada anda. Sila semak dan balas di sini:</p><p><a href="${portalUrl}">${portalUrl}</a></p>`,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    return json({ error: `Resend gagal: ${detail.slice(0, 300)}` }, 500);
  }

  await sbAdmin(env, `/customers?id=eq.${customer_id}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: JSON.stringify({ chat_last_emailed_at: new Date().toISOString() }),
  });

  return json({ sent: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
