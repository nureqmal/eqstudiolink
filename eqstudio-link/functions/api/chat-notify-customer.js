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

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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

  const profiles = await sbAdmin(env, `/profiles?id=eq.${customer.owner_id}&select=business_name,brand_color`);
  const bizName = profiles[0]?.business_name || "Perniagaan";
  const brandColor = profiles[0]?.brand_color || "#4A098F";
  const portalUrl = `${env.PUBLIC_SITE_URL || "https://eqstudio.link"}/portal.html?token=${customer.portal_token}`;

  const html = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDEDF2; padding:32px 16px; border-collapse:collapse;">
      <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:440px; background:#ffffff; border-radius:14px; overflow:hidden; border-collapse:collapse;" cellpadding="0" cellspacing="0">
        <tr><td style="background-color:${brandColor}; background-image:linear-gradient(135deg, ${brandColor}, ${brandColor}); padding:28px 28px 24px; text-align:center;">
          <div style="width:40px; height:40px; border-radius:10px; background:rgba(255,255,255,0.18); display:inline-block; line-height:40px; text-align:center; margin-bottom:10px;"><span style="font-size:18px;">💬</span></div>
          <div style="color:#ffffff; font-size:19px; font-weight:700; font-family:Helvetica,Arial,sans-serif;">Mesej Baharu</div>
          <div style="color:rgba(255,255,255,0.75); font-size:13px; margin-top:4px; font-family:Helvetica,Arial,sans-serif;">${escapeHtml(bizName)}</div>
        </td></tr>
        <tr><td style="padding:26px 28px 28px; text-align:center;">
          <p style="font-size:14px; color:#3A3A42; margin:0 0 18px; font-family:Helvetica,Arial,sans-serif; line-height:1.6;">Salam ${escapeHtml(customer.name)}, ${escapeHtml(bizName)} telah hantar mesej baharu kepada anda.</p>
          <a href="${portalUrl}" style="display:block; text-align:center; background:${brandColor}; color:#ffffff; text-decoration:none; font-weight:700; font-size:13px; padding:11px 18px; border-radius:9px; font-family:Helvetica,Arial,sans-serif;">Semak &amp; Balas Mesej</a>
        </td></tr>
        <tr><td style="padding:18px 28px; background:#FAFAFC; border-top:1px solid #ECECF0; text-align:center;">
          <div style="font-size:11px; color:#B0B0B8; font-family:Helvetica,Arial,sans-serif;">Dihantar melalui eqstudio.link</div>
        </td></tr>
      </table>
      </td></tr>
    </table>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: customer.contact_email,
      subject: `Mesej baharu daripada ${bizName}`,
      html,
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
