// Cloudflare Pages Function — POST /api/booking-notify
// Owner-authenticated (Supabase access token). Body: { booking_id, type: 'reschedule'|'cancel', old_slot_label, new_slot_label, reason }
// Sends the appropriate notification email to the customer.
//
// Required env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL

async function getUserFromToken(env, accessToken) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function sbAdmin(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status}`);
  return res.json();
}

function escapeHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sila log masuk semula." }, 401);
    const user = await getUserFromToken(env, token);
    if (!user?.id) return json({ error: "Sesi tidak sah." }, 401);

    const { booking_id, type, old_slot_label, new_slot_label, reason } = await request.json();
    if (!booking_id || !type) return json({ error: "booking_id dan type diperlukan." }, 400);

    const bookings = await sbAdmin(env, `/bookings?id=eq.${booking_id}&owner_id=eq.${user.id}&select=customer_name,customer_email`);
    const booking = bookings[0];
    if (!booking) return json({ error: "Booking tidak dijumpai." }, 404);

    const profiles = await sbAdmin(env, `/profiles?id=eq.${user.id}&select=business_name,brand_color,logo_url`);
    const profile = profiles[0] || {};
    const bizName = profile.business_name?.trim() || "eqstudio.link";
    const brandColor = profile.brand_color || "#E8834E";
    const logoBlock = profile.logo_url
      ? `<img src="${escapeHtml(profile.logo_url)}" style="max-height:48px; display:block; margin:0 auto 12px;" />`
      : `<div style="font-family:Georgia,serif; font-size:19px; font-weight:600; text-align:center; margin-bottom:12px;">${escapeHtml(bizName)}</div>`;

    let subject, bodyHtml;
    if (type === "reschedule") {
      subject = `Tempahan Anda Ditukar — ${bizName}`;
      bodyHtml = `
        <p style="font-size:15px; margin:0 0 10px;">Salam ${escapeHtml(booking.customer_name)}, tempahan anda dengan <strong>${escapeHtml(bizName)}</strong> telah ditukar:</p>
        <p style="font-size:14px; margin:0 0 4px; text-decoration:line-through; color:#9AA8A2;">${escapeHtml(old_slot_label || "")}</p>
        <p style="font-size:15px; margin:0 0 10px; font-weight:600;">→ ${escapeHtml(new_slot_label || "")}</p>
        ${reason ? `<p style="font-size:13px; color:#4A6259; margin:10px 0 0;"><em>Sebab: ${escapeHtml(reason)}</em></p>` : ""}`;
    } else {
      subject = `Tempahan Anda Dibatalkan — ${bizName}`;
      bodyHtml = `
        <p style="font-size:15px; margin:0 0 10px;">Salam ${escapeHtml(booking.customer_name)}, tempahan anda dengan <strong>${escapeHtml(bizName)}</strong> telah dibatalkan.</p>
        ${reason ? `<p style="font-size:13px; color:#4A6259; margin:10px 0 0;"><em>Sebab: ${escapeHtml(reason)}</em></p>` : ""}
        <p style="font-size:13px; color:#4A6259; margin:12px 0 0;">Hubungi kami kalau nak buat tempahan baru.</p>`;
    }

    const html = `
      <div style="font-family:Helvetica,Arial,sans-serif; max-width:440px; margin:0 auto; background:#FBF7EF; border-radius:10px; overflow:hidden; border:1px solid #E8DFCB;">
        <div style="height:5px; background:${brandColor};"></div>
        <div style="padding:24px 28px;">${logoBlock}${bodyHtml}</div>
      </div>`;

    if (env.RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: booking.customer_email, subject, html }),
      });
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
