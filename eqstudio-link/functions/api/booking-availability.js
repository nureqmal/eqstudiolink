// Cloudflare Pages Function — GET /api/booking-availability?slug=<booking_slug>&days=14&type=<event_type_id>
// Public (no auth) — used by the public /book/<slug> page.
// If the owner has Event Types configured and no `type` param is given, returns the
// list of event types instead of slots (client must pick one, then re-call with `type`).
// If the owner has no Event Types at all, behaves exactly as before (profile-level
// duration/deposit/no type list) — fully backward compatible.
//
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

async function sbAdmin(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Malaysia is a fixed UTC+8 offset year-round (no DST) — safe to hardcode.
const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

function myDateParts(utcDate) {
  const my = new Date(utcDate.getTime() + MY_OFFSET_MS);
  return { year: my.getUTCFullYear(), month: my.getUTCMonth(), date: my.getUTCDate(), day: my.getUTCDay(), hh: my.getUTCHours(), mm: my.getUTCMinutes() };
}

// Builds a UTC timestamp for a given Malaysia-local Y/M/D + HH:mm wall-clock time.
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
    const profiles = await sbAdmin(env, `/profiles?booking_slug=eq.${encodeURIComponent(slug)}&select=id,business_name,logo_url,brand_color,slot_duration_minutes,booking_min_notice_hours,default_deposit_amount,buffer_minutes`);
    let profile = profiles[0];
    if (!profile) {
      // Not the primary slug — check secondary Pro-tier booking_links (same calendar, alternate slug)
      const links = await sbAdmin(env, `/booking_links?slug=eq.${encodeURIComponent(slug)}&select=owner_id`);
      if (links[0]) {
        const ownerProfiles = await sbAdmin(env, `/profiles?id=eq.${links[0].owner_id}&select=id,business_name,logo_url,brand_color,slot_duration_minutes,booking_min_notice_hours,default_deposit_amount,buffer_minutes`);
        profile = ownerProfiles[0];
      }
    }
    if (!profile) return json({ error: "Link booking tidak dijumpai." }, 404);

    const eventTypes = await sbAdmin(env, `/event_types?owner_id=eq.${profile.id}&is_active=eq.true&select=*&order=sort_order.asc`);
    const questions = await sbAdmin(env, `/booking_questions?owner_id=eq.${profile.id}&select=id,question_text&order=sort_order.asc`);
    const business = { name: profile.business_name, logo_url: profile.logo_url, brand_color: profile.brand_color };

    // Owner has event types but customer hasn't picked one yet — return the list only.
    if (eventTypes.length > 0 && !requestedTypeId) {
      return json({ business, event_types: eventTypes, slots_by_date: null, questions });
    }

    let durationMinutes = profile.slot_duration_minutes || 60;
    let capacity = 1;
    let depositAmount = profile.default_deposit_amount;
    let selectedType = null;
    if (requestedTypeId) {
      selectedType = eventTypes.find(t => t.id === requestedTypeId);
      if (!selectedType) return json({ error: "Jenis perkhidmatan tidak dijumpai." }, 404);
      durationMinutes = selectedType.duration_minutes;
      capacity = selectedType.capacity || 1;
      depositAmount = selectedType.deposit_amount != null ? selectedType.deposit_amount : profile.default_deposit_amount;
    }
    if (depositAmount == null) {
      return json({ error: "Perniagaan ni belum sedia untuk terima booking online. Sila hubungi mereka terus." }, 400);
    }

    const now = new Date();
    const earliestAllowed = new Date(now.getTime() + (profile.booking_min_notice_hours || 0) * 60 * 60 * 1000);
    const rangeEnd = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const durationMs = durationMinutes * 60 * 1000;
    const bufferMs = (profile.buffer_minutes || 0) * 60 * 1000;

    const existing = await sbAdmin(
      env,
      `/bookings?owner_id=eq.${profile.id}&status=eq.confirmed&slot_datetime=gte.${now.toISOString()}&slot_datetime=lte.${rangeEnd.toISOString()}&select=slot_datetime,duration_minutes,event_type_id`
    );

    // Same-type-same-slot bookings are capacity-managed (not a hard block) — everything
    // else still buffer-blocks normally, exactly as before Event Types existed.
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

    const availability = await sbAdmin(env, `/availability?owner_id=eq.${profile.id}&select=day_of_week,start_time,end_time`);
    if (availability.length === 0) {
      return json({ business, event_types: eventTypes, slots_by_date: {}, questions, slot_duration_minutes: durationMinutes, capacity });
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

    return json({ business, event_types: eventTypes, slot_duration_minutes: durationMinutes, capacity, slots_by_date: slotsByDate, questions });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
