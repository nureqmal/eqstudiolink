// Cloudflare Pages Function — POST /api/booking-customer-action
// Public (no auth) — used by the customer self-serve manage-booking page.
// Body: { token, action: 'reschedule' | 'cancel', new_slot_iso?, reason? }
//
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL

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
  return res;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function notifyOwner(env, { ownerEmail, bizName, brandColor, subject, bodyHtml }) {
  if (!env.RESEND_API_KEY || !ownerEmail) return;
  const html = `
    <div style="font-family:Helvetica,Arial,sans-serif; max-width:440px; margin:0 auto; background:#FBF7EF; border-radius:10px; overflow:hidden; border:1px solid #E8DFCB;">
      <div style="height:5px; background:${brandColor};"></div>
      <div style="padding:24px 28px;">${bodyHtml}</div>
    </div>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: ownerEmail, subject, html }),
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { token, action, new_slot_iso, reason } = await request.json();
    if (!token || !action) return json({ error: "token dan action diperlukan." }, 400);

    const bookRes = await sbAdmin(env, `/bookings?manage_token=eq.${token}&select=*`);
    const bookings = await bookRes.json();
    const booking = bookings[0];
    if (!booking) return json({ error: "Tempahan tidak dijumpai." }, 404);
    if (booking.status === "cancelled") return json({ error: "Tempahan ni dah dibatalkan." }, 400);

    const profRes = await sbAdmin(env, `/profiles?id=eq.${booking.owner_id}&select=business_name,contact_email,brand_color,cancellation_notice_hours`);
    const profiles = await profRes.json();
    const profile = profiles[0] || {};
    const bizName = profile.business_name?.trim() || "eqstudio.link";
    const brandColor = profile.brand_color || "#E8834E";

    if (action === "cancel") {
      const noticeHours = profile.cancellation_notice_hours || 0;
      if (noticeHours > 0) {
        const cutoff = new Date(new Date(booking.slot_datetime).getTime() - noticeHours * 60 * 60 * 1000);
        if (new Date() > cutoff) {
          return json({ error: `Dah terlalu hampir dengan masa janji temu untuk cancel sendiri (perlu sekurang-kurangnya ${noticeHours} jam awal). Sila hubungi ${bizName} terus.` }, 400);
        }
      }

      await sbAdmin(env, `/bookings?id=eq.${booking.id}`, { method: "PATCH", prefer: "return=minimal", body: JSON.stringify({ status: "cancelled" }) });

      if (booking.customer_id) {
        const custRes = await sbAdmin(env, `/customers?id=eq.${booking.customer_id}&select=status`);
        const custs = await custRes.json();
        if (custs[0] && custs[0].status !== "dah_bayar") {
          await sbAdmin(env, `/customers?id=eq.${booking.customer_id}`, { method: "DELETE", prefer: "return=minimal" });
        }
      }

      await notifyOwner(env, {
        ownerEmail: profile.contact_email, bizName, brandColor,
        subject: `Tempahan Dibatalkan Customer — ${escapeHtml(booking.customer_name)}`,
        bodyHtml: `<p style="font-size:15px; margin:0 0 8px;"><strong>${escapeHtml(booking.customer_name)}</strong> telah batalkan tempahan mereka.</p>${reason ? `<p style="font-size:13px; color:#4A6259;"><em>Sebab: ${escapeHtml(reason)}</em></p>` : ""}`,
      });

      return json({ success: true });
    }

    if (action === "reschedule") {
      if (!new_slot_iso) return json({ error: "Slot baru diperlukan." }, 400);
      const oldLabel = new Date(booking.slot_datetime).toLocaleString("ms-MY", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });
      const newLabel = new Date(new_slot_iso).toLocaleString("ms-MY", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });

      const updateRes = await sbAdmin(env, `/bookings?id=eq.${booking.id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify({ slot_datetime: new_slot_iso }),
      });
      if (!updateRes.ok) {
        const detail = await updateRes.text();
        if (detail.includes("duplicate") || detail.includes("unique")) {
          return json({ error: "Alamak, slot ni baru sahaja diambil orang lain. Sila pilih slot lain." }, 409);
        }
        return json({ error: `Gagal reschedule: ${detail}` }, 502);
      }

      await notifyOwner(env, {
        ownerEmail: profile.contact_email, bizName, brandColor,
        subject: `Tempahan Ditukar Customer — ${escapeHtml(booking.customer_name)}`,
        bodyHtml: `
          <p style="font-size:15px; margin:0 0 8px;"><strong>${escapeHtml(booking.customer_name)}</strong> telah tukar tempahan mereka:</p>
          <p style="font-size:14px; text-decoration:line-through; color:#9AA8A2; margin:0;">${escapeHtml(oldLabel)}</p>
          <p style="font-size:14px; font-weight:600; margin:0 0 8px;">→ ${escapeHtml(newLabel)}</p>`,
      });

      return json({ success: true, new_slot_label: newLabel });
    }

    return json({ error: "Action tidak dikenali." }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
