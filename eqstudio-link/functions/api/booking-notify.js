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

    let subject, iconEmoji, headerTitle, bodyHtml;
    if (type === "reschedule") {
      subject = `Tempahan Anda Ditukar — ${bizName}`;
      iconEmoji = "🔄";
      headerTitle = "Tempahan Ditukar";
      bodyHtml = `
        <tr><td style="padding:26px 28px 8px;">
          <p style="font-size:14px; color:#3A3A42; margin:0 0 16px; font-family:Helvetica,Arial,sans-serif; line-height:1.6;">Salam ${escapeHtml(booking.customer_name)}, tempahan anda dengan <strong>${escapeHtml(bizName)}</strong> telah ditukar:</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFC; border:1px solid #ECECF0; border-radius:10px; border-collapse:collapse;">
            <tr><td style="padding:14px 16px; border-bottom:1px solid #ECECF0;">
              <div style="font-size:11px; color:#9A9AA5; text-transform:uppercase; letter-spacing:0.04em;">Slot Lama</div>
              <div style="font-size:13px; color:#B0B0B8; text-decoration:line-through; font-family:'SF Mono',Consolas,monospace; margin-top:2px;">${escapeHtml(old_slot_label || "")}</div>
            </td></tr>
            <tr><td style="padding:14px 16px;">
              <div style="font-size:11px; color:#9A9AA5; text-transform:uppercase; letter-spacing:0.04em;">Slot Baharu</div>
              <div style="font-size:14px; color:#1B1B22; font-weight:700; font-family:'SF Mono',Consolas,monospace; margin-top:2px;">${escapeHtml(new_slot_label || "")}</div>
            </td></tr>
          </table>
          ${reason ? `<p style="font-size:13px; color:#6B6B75; margin:14px 0 0; font-family:Helvetica,Arial,sans-serif;"><em>Sebab: ${escapeHtml(reason)}</em></p>` : ""}
        </td></tr>`;
    } else {
      subject = `Tempahan Anda Dibatalkan — ${bizName}`;
      iconEmoji = "❌";
      headerTitle = "Tempahan Dibatalkan";
      bodyHtml = `
        <tr><td style="padding:26px 28px 8px;">
          <p style="font-size:14px; color:#3A3A42; margin:0 0 12px; font-family:Helvetica,Arial,sans-serif; line-height:1.6;">Salam ${escapeHtml(booking.customer_name)}, tempahan anda dengan <strong>${escapeHtml(bizName)}</strong> telah dibatalkan.</p>
          ${reason ? `<p style="font-size:13px; color:#6B6B75; margin:8px 0 0; font-family:Helvetica,Arial,sans-serif;"><em>Sebab: ${escapeHtml(reason)}</em></p>` : ""}
          <p style="font-size:13px; color:#9A9AA5; margin:14px 0 0; font-family:Helvetica,Arial,sans-serif;">Hubungi kami kalau nak buat tempahan baharu.</p>
        </td></tr>`;
    }

    const html = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDEDF2; padding:32px 16px; border-collapse:collapse;">
        <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:440px; background:#ffffff; border-radius:14px; overflow:hidden; border-collapse:collapse;" cellpadding="0" cellspacing="0">
          <tr><td style="background-color:${brandColor}; background-image:linear-gradient(135deg, ${brandColor}, ${brandColor}); padding:28px 28px 24px; text-align:center;">
            <div style="width:40px; height:40px; border-radius:10px; background:rgba(255,255,255,0.18); display:inline-block; line-height:40px; text-align:center; margin-bottom:10px;"><span style="font-size:18px;">${iconEmoji}</span></div>
            ${profile.logo_url ? `<img src="${escapeHtml(profile.logo_url)}" style="max-height:32px; display:block; margin:0 auto;" />` : ""}
            <div style="color:#ffffff; font-size:19px; font-weight:700; font-family:Helvetica,Arial,sans-serif; margin-top:4px;">${headerTitle}</div>
            <div style="color:rgba(255,255,255,0.75); font-size:13px; margin-top:4px; font-family:Helvetica,Arial,sans-serif;">${escapeHtml(bizName)}</div>
          </td></tr>
          ${bodyHtml}
          <tr><td style="padding:18px 28px; background:#FAFAFC; border-top:1px solid #ECECF0; text-align:center;">
            <div style="font-size:11px; color:#B0B0B8; font-family:Helvetica,Arial,sans-serif;">Dihantar melalui eqstudio.link</div>
          </td></tr>
        </table>
        </td></tr>
      </table>`;

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
