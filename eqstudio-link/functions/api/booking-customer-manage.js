// Cloudflare Pages Function — GET /api/booking-customer-manage?token=<manage_token>&days=21
// Public (no auth) — used by the customer self-serve manage-booking page.
// Booking links are fully independent — slot computation now uses the booking's
// OWN booking_link settings/availability, not the owner's profile-level defaults.
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

async function sbAdmin(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

function myDateParts(utcDate) {
  const my = new Date(utcDate.getTime() + MY_OFFSET_MS);
  return { year: my.getUTCFullYear(), month: my.getUTCMonth(), date: my.getUTCDate(), day: my.getUTCDay(), hh: my.getUTCHours(), mm: my.getUTCMinutes() };
}
function myWallClockToUTC(year, month, date, hh, mm) {
  return new Date(Date.UTC(year, month, date, hh, mm, 0) - MY_OFFSET_MS);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const daysAhead = Math.min(parseInt(url.searchParams.get("days"), 10) || 21, 30);
  if (!token) return json({ error: "Token diperlukan." }, 400);

  try {
    const bookings = await sbAdmin(env, `/bookings?manage_token=eq.${token}&select=id,owner_id,booking_link_id,slot_datetime,duration_minutes,customer_name,customer_email,status`);
    const booking = bookings[0];
    if (!booking) return json({ error: "Tempahan tidak dijumpai." }, 404);

    const links = booking.booking_link_id ? await sbAdmin(env, `/booking_links?id=eq.${booking.booking_link_id}&select=*`) : [];
    const link = links[0] || {};

    const profiles = await sbAdmin(env, `/profiles?id=eq.${booking.owner_id}&select=business_name,logo_url,brand_color`);
    const profile = profiles[0] || {};
    const bizName = link.label || profile.business_name;

    const currentSlotLabel = new Date(booking.slot_datetime).toLocaleString("ms-MY", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });

    if (booking.status === "cancelled" || !booking.booking_link_id) {
      return json({ booking: { ...booking, current_slot_label: currentSlotLabel }, business: { name: bizName }, slots_by_date: {} });
    }

    const durationMs = (booking.duration_minutes || link.slot_duration_minutes || 60) * 60 * 1000;
    const now = new Date();
    const earliestAllowed = new Date(now.getTime() + (link.booking_min_notice_hours || 0) * 60 * 60 * 1000);
    const rangeEnd = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const bufferMs = (link.buffer_minutes || 0) * 60 * 1000;

    const existing = await sbAdmin(
      env,
      `/bookings?booking_link_id=eq.${booking.booking_link_id}&status=eq.confirmed&id=neq.${booking.id}&slot_datetime=gte.${now.toISOString()}&slot_datetime=lte.${rangeEnd.toISOString()}&select=slot_datetime,duration_minutes`
    );
    const blockedRanges = existing.map(b => {
      const start = new Date(b.slot_datetime).getTime() - bufferMs;
      const end = new Date(b.slot_datetime).getTime() + (b.duration_minutes || 60) * 60 * 1000 + bufferMs;
      return [start, end];
    });
    function isBlocked(slotStartMs) {
      const slotEndMs = slotStartMs + durationMs;
      return blockedRanges.some(([bStart, bEnd]) => slotStartMs < bEnd && slotEndMs > bStart);
    }

    const rangeEndDateKey = (() => {
      const p = myDateParts(rangeEnd);
      return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.date).padStart(2, "0")}`;
    })();
    const todayDateKey = (() => {
      const p = myDateParts(now);
      return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.date).padStart(2, "0")}`;
    })();
    const availability = await sbAdmin(
      env,
      `/availability_dates?booking_link_id=eq.${booking.booking_link_id}&specific_date=gte.${todayDateKey}&specific_date=lte.${rangeEndDateKey}&select=specific_date,start_time,end_time`
    );
    const availByDate = new Map();
    for (const a of availability) {
      if (!availByDate.has(a.specific_date)) availByDate.set(a.specific_date, []);
      availByDate.get(a.specific_date).push(a);
    }

    const slotsByDate = {};

    for (let d = 0; d <= daysAhead; d++) {
      const cursor = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
      const { year, month, date } = myDateParts(cursor);
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
      const dayRanges = availByDate.get(dateKey);
      if (!dayRanges) continue;

      const daySlots = [];

      for (const range of dayRanges) {
        const [startH, startM] = range.start_time.split(":").map(Number);
        const [endH, endM] = range.end_time.split(":").map(Number);
        let slotStart = myWallClockToUTC(year, month, date, startH, startM);
        const rangeEndUtc = myWallClockToUTC(year, month, date, endH, endM);

        while (slotStart.getTime() + durationMs <= rangeEndUtc.getTime()) {
          if (slotStart >= earliestAllowed && !isBlocked(slotStart.getTime())) {
            const parts = myDateParts(slotStart);
            daySlots.push({ iso: slotStart.toISOString(), label: `${String(parts.hh).padStart(2, "0")}:${String(parts.mm).padStart(2, "0")}` });
          }
          slotStart = new Date(slotStart.getTime() + durationMs);
        }
      }
      if (daySlots.length > 0) slotsByDate[dateKey] = daySlots;
    }

    return json({
      booking: { ...booking, current_slot_label: currentSlotLabel },
      business: { name: bizName, logo_url: profile.logo_url, brand_color: profile.brand_color },
      slot_duration_minutes: link.slot_duration_minutes,
      slots_by_date: slotsByDate,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
