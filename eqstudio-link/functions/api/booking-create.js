// Cloudflare Pages Function — POST /api/booking-create
// Public (no auth) — used by the public /book.html?slug=<slug> page.
// Body: { slug, slot_iso, event_type_id, duration_minutes, name, email, phone, notes, custom_answers, preferred_language }
//
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL,
//   PUBLIC_SITE_URL, and (optional but recommended) WORKER_CRON_URL + MANUAL_TRIGGER_KEY for instant reminder.

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

// Note: zh/ta are AI-generated translations — recommend native-speaker review before go-live.
const BOOKING_I18N = {
  ms: { title: "Tempahan Disahkan! ✅", greet: (n, b) => `Salam ${n}, tempahan anda dengan <strong>${b}</strong> telah disahkan:`, footer: "Kami akan hantar reminder deposit berasingan sekejap lagi.", manageLink: "Reschedule / Batal Tempahan", subject: "Tempahan Disahkan" },
  en: { title: "Booking Confirmed! ✅", greet: (n, b) => `Hi ${n}, your booking with <strong>${b}</strong> has been confirmed:`, footer: "We'll send a separate deposit reminder shortly.", manageLink: "Reschedule / Cancel Booking", subject: "Booking Confirmed" },
  zh: { title: "预订已确认！✅", greet: (n, b) => `您好 ${n}，您与 <strong>${b}</strong> 的预订已确认：`, footer: "我们稍后将发送单独的押金提醒。", manageLink: "更改时间 / 取消预订", subject: "预订已确认" },
  ta: { title: "முன்பதிவு உறுதி செய்யப்பட்டது! ✅", greet: (n, b) => `வணக்கம் ${n}, <strong>${b}</strong> உடனான உங்கள் முன்பதிவு உறுதி செய்யப்பட்டது:`, footer: "வைப்புத்தொகை நினைவூட்டலை தனியாக விரைவில் அனுப்புவோம்.", manageLink: "மறு திட்டமிடல் / முன்பதிவை ரத்து செய்யவும்", subject: "முன்பதிவு உறுதி செய்யப்பட்டது" },
};

async function sendConfirmationEmails(env, { profile, bizName, booking, slotLabel, dateLabel, lang }) {
  if (!env.RESEND_API_KEY) return;
  const brandColor = profile.brand_color || "#4F46E5";
  const site = env.PUBLIC_SITE_URL || "https://eqstudio.link";
  const manageUrl = `${site}/manage-booking.html?token=${booking.manage_token}`;
  const T = BOOKING_I18N[lang] || BOOKING_I18N.ms;

  const customerHtml = `
    <div style="font-family:Helvetica,Arial,sans-serif; max-width:440px; margin:0 auto; background:#FAFAFA; border-radius:10px; overflow:hidden; border:1px solid #E4E4E9;">
      <div style="height:5px; background:${brandColor};"></div>
      <div style="padding:24px 28px;">
        <p style="font-size:16px; font-weight:600; margin:0 0 8px;">${T.title}</p>
        <p style="font-size:14px; color:#6B6B75; margin:0 0 16px;">${T.greet(escapeHtml(booking.customer_name), escapeHtml(bizName))}</p>
        <p style="font-size:14px; margin:0 0 4px;">📅 ${dateLabel}, ${slotLabel}</p>
        <p style="font-size:12px; color:#9A9AA5; margin:16px 0 12px;">${T.footer}</p>
        <a href="${manageUrl}" style="display:block; text-align:center; background:#ffffff; color:${brandColor}; text-decoration:none; font-weight:600; font-size:13px; padding:10px 18px; border-radius:8px; border:1.5px solid ${brandColor};">${T.manageLink}</a>
      </div>
    </div>`;

  const ownerHtml = `
    <div style="font-family:Helvetica,Arial,sans-serif; max-width:440px; margin:0 auto; background:#FAFAFA; border-radius:10px; overflow:hidden; border:1px solid #E4E4E9;">
      <div style="height:5px; background:${brandColor};"></div>
      <div style="padding:24px 28px;">
        <p style="font-size:16px; font-weight:600; margin:0 0 8px;">Tempahan Baru! 🎉</p>
        <p style="font-size:14px; margin:0 0 4px;"><strong>${escapeHtml(booking.customer_name)}</strong> — ${escapeHtml(booking.customer_email)}${booking.customer_phone ? " — " + escapeHtml(booking.customer_phone) : ""}</p>
        <p style="font-size:14px; margin:0 0 4px;">📅 ${dateLabel}, ${slotLabel}</p>
        ${booking.customer_notes ? `<p style="font-size:13px; color:#6B6B75; margin:8px 0 0;"><em>${escapeHtml(booking.customer_notes)}</em></p>` : ""}
        ${booking.custom_answers && Object.keys(booking.custom_answers).length ? `
        <div style="margin-top:10px; padding-top:10px; border-top:1px dashed #E4E4E9;">
          ${Object.entries(booking.custom_answers).map(([q, a]) => `<p style="font-size:13px; color:#6B6B75; margin:0 0 4px;"><strong>${escapeHtml(q)}:</strong> ${escapeHtml(a)}</p>`).join("")}
        </div>` : ""}
        <p style="font-size:12px; color:#9A9AA5; margin:14px 0 0;">Satu lagi customer percaya bisnes anda. Teruskan usaha!</p>
      </div>
    </div>`;

  const sends = [
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: booking.customer_email, subject: `${T.subject} — ${bizName}`, html: customerHtml }),
    }),
  ];
  if (profile.contact_email) {
    sends.push(fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: profile.contact_email, subject: `Tempahan Baru — ${escapeHtml(booking.customer_name)}`, html: ownerHtml }),
    }));
  }
  await Promise.allSettled(sends);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { slug, slot_iso, event_type_id, duration_minutes, name, email, phone, notes, preferred_language, custom_answers } = await request.json();
    if (!slug || !slot_iso || !name?.trim() || !email?.trim()) {
      return json({ error: "Nama, emel, dan slot diperlukan." }, 400);
    }
    const lang = ["ms", "en", "zh", "ta"].includes(preferred_language) ? preferred_language : "ms";

    const linkRes = await sbAdmin(env, `/booking_links?slug=eq.${encodeURIComponent(slug)}&select=*`);
    const links = await linkRes.json();
    const link = links[0];
    if (!link) return json({ error: "Link booking tidak dijumpai." }, 404);

    const profRes = await sbAdmin(env, `/profiles?id=eq.${link.owner_id}&select=business_name,contact_email,brand_color`);
    const profiles = await profRes.json();
    const profile = profiles[0] || {};
    const bizName = link.label || profile.business_name || "eqstudio.link";

    let depositAmount = link.default_deposit_amount;
    let capacity = 1;
    let resolvedDuration = duration_minutes || 60;
    if (event_type_id) {
      const typeRes = await sbAdmin(env, `/event_types?id=eq.${event_type_id}&booking_link_id=eq.${link.id}&select=*`);
      const types = await typeRes.json();
      const type = types[0];
      if (!type) return json({ error: "Jenis perkhidmatan tidak dijumpai." }, 404);
      // No fallback to the link default — event types always carry an explicit
      // deposit set by the owner, no hidden runtime inheritance.
      depositAmount = type.deposit_amount;
      capacity = type.capacity || 1;
      resolvedDuration = type.duration_minutes;
    }

    if (depositAmount == null) {
      return json({ error: "Perniagaan ni belum setkan deposit lalai. Sila hubungi mereka terus untuk tempah." }, 400);
    }

    const slotDate = new Date(slot_iso);
    const earliestAllowed = new Date(Date.now() + (link.booking_min_notice_hours || 0) * 60 * 60 * 1000);
    if (slotDate < earliestAllowed) {
      return json({ error: "Slot ni terlalu hampir dengan masa sekarang. Sila pilih slot lain." }, 400);
    }

    if (event_type_id) {
      const existingRes = await sbAdmin(env, `/bookings?booking_link_id=eq.${link.id}&event_type_id=eq.${event_type_id}&slot_datetime=eq.${slotDate.toISOString()}&status=eq.confirmed&select=id`);
      const existingAtSlot = await existingRes.json();
      if (existingAtSlot.length >= capacity) {
        return json({ error: "Alamak, slot ni dah penuh. Sila pilih slot lain." }, 409);
      }
    }

    const todayISO = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const custRes = await sbAdmin(env, "/customers", {
      method: "POST",
      body: JSON.stringify({
        owner_id: link.owner_id,
        name: name.trim(),
        contact_email: email.trim(),
        contact_phone: phone?.trim() || null,
        amount: depositAmount,
        due_date: todayISO,
        notes: notes?.trim() ? `Booking: ${notes.trim()}` : "Deposit tempahan booking",
        status: "belum_bayar",
        preferred_language: lang,
      }),
    });
    if (!custRes.ok) return json({ error: `Gagal cipta rekod pelanggan: ${await custRes.text()}` }, 502);
    const customers = await custRes.json();
    const customer = customers[0];

    const bookingRes = await sbAdmin(env, "/bookings", {
      method: "POST",
      body: JSON.stringify({
        owner_id: link.owner_id,
        customer_id: customer.id,
        booking_link_id: link.id,
        event_type_id: event_type_id || null,
        slot_datetime: slotDate.toISOString(),
        duration_minutes: resolvedDuration,
        customer_name: name.trim(),
        customer_email: email.trim(),
        customer_phone: phone?.trim() || null,
        customer_notes: notes?.trim() || null,
        custom_answers: custom_answers && typeof custom_answers === "object" ? custom_answers : null,
        status: "confirmed",
      }),
    });

    if (!bookingRes.ok) {
      const detail = await bookingRes.text();
      await sbAdmin(env, `/customers?id=eq.${customer.id}`, { method: "DELETE", prefer: "return=minimal" });
      return json({ error: `Gagal buat tempahan: ${detail}` }, 502);
    }
    const bookings = await bookingRes.json();
    const booking = bookings[0];

    if (env.WORKER_CRON_URL && env.MANUAL_TRIGGER_KEY && Number(customer.amount) > 0) {
      try {
        await fetch(`${env.WORKER_CRON_URL}/?key=${encodeURIComponent(env.MANUAL_TRIGGER_KEY)}&run=single&customer_id=${encodeURIComponent(customer.id)}`);
      } catch { /* the daily cron will still catch it */ }
    }

    const myParts = new Date(slotDate.getTime() + 8 * 60 * 60 * 1000);
    const dateLabel = myParts.toLocaleDateString("ms-MY", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    const slotLabel = `${String(myParts.getUTCHours()).padStart(2, "0")}:${String(myParts.getUTCMinutes()).padStart(2, "0")}`;

    await sendConfirmationEmails(env, { profile, bizName, booking, slotLabel, dateLabel, lang });

    return json({ success: true, booking_id: booking.id, date_label: dateLabel, slot_label: slotLabel });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
