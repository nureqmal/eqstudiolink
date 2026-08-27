// Cloudflare Pages Function — GET /api/booking-availability?slug=<slug>&days=14&type=<event_type_id>
// Public (no auth) — used by the public /book.html?slug=<slug> page.
// Every booking_links row (including the "primary" one) is now fully independent:
// its own availability, event types, questions, and settings — not shared with
// the owner's other links.
//
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
  const slug = url.searchParams.get("slug");
  const requestedTypeId = url.searchParams.get("type") || null;
  const daysAhead = Math.min(parseInt(url.searchParams.get("days"), 10) || 14, 30);
  if (!slug) return json({ error: "slug diperlukan." }, 400);

  try {
    const links = await sbAdmin(env, `/booking_links?slug=eq.${encodeURIComponent(slug)}&select=*`);
    const link = links[0];
    if (!link) return json({ error: "Link booking tidak dijumpai." }, 404);

    const profiles = await sbAdmin(env, `/profiles?id=eq.${link.owner_id}&select=business_name,logo_url,brand_color`);
    const profile = profiles[0] || {};
    const business = { name: link.label || profile.business_name, logo_url: profile.logo_url, brand_color: profile.brand_color };

    const eventTypes = await sbAdmin(env, `/event_types?booking_link_id=eq.${link.id}&is_active=eq.true&select=*&order=sort_order.asc`);
    const questions = await sbAdmin(env, `/booking_questions?booking_link_id=eq.${link.id}&select=id,question_text&order=sort_order.asc`);

    if (eventTypes.length > 0 && !requestedTypeId) {
      return json({ business, event_types: eventTypes, slots_by_date: null, questions, link_description: link.description, link_poster_url: link.poster_url });
    }

    let durationMinutes = link.slot_duration_minutes || 60;
    let capacity = 1;
    let depositAmount = link.default_deposit_amount;
    if (requestedTypeId) {
      const selectedType = eventTypes.find(t => t.id === requestedTypeId);
      if (!selectedType) return json({ error: "Jenis perkhidmatan tidak dijumpai." }, 404);
      durationMinutes = selectedType.duration_minutes;
      capacity = selectedType.capacity || 1;
      // No fallback to the link default anymore — event types always carry an
      // explicit deposit (the dashboard pre-fills it as a one-time convenience,
      // but what's saved is what's charged, with no hidden runtime inheritance).
      depositAmount = selectedType.deposit_amount;
    }
    if (depositAmount == null) {
      return json({ error: "Perniagaan ni belum sedia untuk terima booking online. Sila hubungi mereka terus." }, 400);
    }

    const now = new Date();
    const earliestAllowed = new Date(now.getTime() + (link.booking_min_notice_hours || 0) * 60 * 60 * 1000);
    const rangeEnd = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const durationMs = durationMinutes * 60 * 1000;
    const bufferMs = (link.buffer_minutes || 0) * 60 * 1000;

    const existing = await sbAdmin(
      env,
      `/bookings?booking_link_id=eq.${link.id}&status=eq.confirmed&slot_datetime=gte.${now.toISOString()}&slot_datetime=lte.${rangeEnd.toISOString()}&select=slot_datetime,duration_minutes,event_type_id`
    );

    const sameSlotCounts = new Map();
    if (requestedTypeId) {
      for (const b of existing) {
        if (b.event_type_id === requestedTypeId) {
          const key = new Date(b.slot_datetime).toISOString();
          sameSlotCounts.set(key, (sameSlotCounts.get(key) || 0) + 1);
        }
      }
    }
    const blockedRanges = existing
      .filter(b => !(requestedTypeId && b.event_type_id === requestedTypeId))
      .map(b => {
        const start = new Date(b.slot_datetime).getTime() - bufferMs;
        const end = new Date(b.slot_datetime).getTime() + (b.duration_minutes || 60) * 60 * 1000 + bufferMs;
        return [start, end];
      });
    function isBlocked(slotStartMs) {
      const slotEndMs = slotStartMs + durationMs;
      return blockedRanges.some(([bStart, bEnd]) => slotStartMs < bEnd && slotEndMs > bStart);
    }

    const availability = await sbAdmin(env, `/availability?booking_link_id=eq.${link.id}&select=day_of_week,start_time,end_time`);
    if (availability.length === 0) {
      return json({ business, event_types: eventTypes, slots_by_date: {}, questions, slot_duration_minutes: durationMinutes, capacity, deposit_amount: depositAmount, link_description: link.description, link_poster_url: link.poster_url });
    }

    const availByDay = new Map();
    for (const a of availability) {
      if (!availByDay.has(a.day_of_week)) availByDay.set(a.day_of_week, []);
      availByDay.get(a.day_of_week).push(a);
    }

    const slotsByDate = {};
    for (let d = 0; d <= daysAhead; d++) {
      const cursor = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
      const { year, month, date, day } = myDateParts(cursor);
      const dayRanges = availByDay.get(day);
      if (!dayRanges) continue;

      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
      const daySlots = [];

      for (const range of dayRanges) {
        const [startH, startM] = range.start_time.split(":").map(Number);
        const [endH, endM] = range.end_time.split(":").map(Number);
        let slotStart = myWallClockToUTC(year, month, date, startH, startM);
        const rangeEndUtc = myWallClockToUTC(year, month, date, endH, endM);

        while (slotStart.getTime() + durationMs <= rangeEndUtc.getTime()) {
          const iso = slotStart.toISOString();
          const capacityFull = requestedTypeId ? (sameSlotCounts.get(iso) || 0) >= capacity : false;
          if (slotStart >= earliestAllowed && !isBlocked(slotStart.getTime()) && !capacityFull) {
            const parts = myDateParts(slotStart);
            daySlots.push({ iso, label: `${String(parts.hh).padStart(2, "0")}:${String(parts.mm).padStart(2, "0")}` });
          }
          slotStart = new Date(slotStart.getTime() + durationMs);
        }
      }
      if (daySlots.length > 0) slotsByDate[dateKey] = daySlots;
    }

    return json({ business, event_types: eventTypes, slot_duration_minutes: durationMinutes, capacity, slots_by_date: slotsByDate, questions, deposit_amount: depositAmount, link_description: link.description, link_poster_url: link.poster_url });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
