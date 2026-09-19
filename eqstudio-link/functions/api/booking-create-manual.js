// Cloudflare Pages Function — POST /api/booking-create-manual
// Owner-authenticated (Supabase access token). Lets the owner create a booking
// directly from the dashboard — for walk-in/phone customers, converting a
// Lead into a real booking, or a multi-ceremony project (Nikah + Sanding +
// Resepsi as one grouped booking) — without the customer going through the
// public book.html link.
//
// Deliberately does NOT re-run the "available slots" computation that
// book.html uses: a manual entry is trusted owner input, and owners may
// legitimately want to log a booking outside normal operating hours (a
// special accommodation). The database's unique (owner_id, slot_datetime)
// constraint remains the real safety net against exact double-booking.
//
// Body (single session — backward compatible):
//   { slot_datetime, duration_minutes, event_type_id?, customer_name,
//     customer_email, customer_phone?, customer_notes?, lead_id? }
//
// Body (multi-ceremony — several sessions grouped as one project):
//   { legs: [{ slot_datetime, duration_minutes, event_type_id?, ceremony_label }, ...],
//     customer_name, customer_email, customer_phone?, customer_notes?, lead_id? }
//   All legs are inserted in a single batch insert, so if any single leg
//   collides with an existing booking, the whole project fails together
//   (Postgres rejects the whole batch on a unique-constraint violation) —
//   avoids leaving a half-booked project behind.
//
// Required env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { pushBookingToCalendar } from "../lib/google-calendar-push.js";

async function getUserFromToken(env, accessToken) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function sbAdmin(env, path, options = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: options.method === "POST" ? "return=representation" : (options.headers?.Prefer || ""),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path} failed (${res.status}): ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sila log masuk semula." }, 401);
    const user = await getUserFromToken(env, token);
    if (!user?.id) return json({ error: "Sesi tidak sah." }, 401);

    const body = await request.json();
    const { customer_name, customer_email, customer_phone, customer_notes, lead_id } = body;

    if (!customer_name?.trim() || !customer_email?.trim()) {
      return json({ error: "Nama dan emel pelanggan diperlukan." }, 400);
    }

    // Normalize to a legs array either way — single-session requests become
    // a one-leg array, so the rest of the logic is shared.
    const isMultiCeremony = Array.isArray(body.legs) && body.legs.length > 0;
    const legs = isMultiCeremony
      ? body.legs
      : [{ slot_datetime: body.slot_datetime, duration_minutes: body.duration_minutes, event_type_id: body.event_type_id, ceremony_label: null }];

    for (const leg of legs) {
      if (!leg.slot_datetime || !leg.duration_minutes) {
        return json({ error: "Setiap sesi perlu tarikh/masa dan tempoh." }, 400);
      }
    }

    const groupId = isMultiCeremony && legs.length > 1 ? crypto.randomUUID() : null;

    const insertPayload = legs.map(leg => ({
      owner_id: user.id,
      event_type_id: leg.event_type_id || null,
      slot_datetime: leg.slot_datetime,
      duration_minutes: leg.duration_minutes,
      customer_name: customer_name.trim(),
      customer_email: customer_email.trim(),
      customer_phone: customer_phone?.trim() || null,
      customer_notes: customer_notes?.trim() || null,
      status: "confirmed",
      group_id: groupId,
      ceremony_label: leg.ceremony_label?.trim() || null,
    }));

    let bookings;
    try {
      bookings = await sbAdmin(env, "/bookings", { method: "POST", body: JSON.stringify(insertPayload) });
    } catch (err) {
      if (err.message.includes("duplicate key") || err.message.includes("23505")) {
        return json({ error: "Salah satu sesi bertindih dengan tempahan sedia ada. Sila semak tarikh/masa." }, 409);
      }
      throw err;
    }

    // Push every session to the owner's Google Calendar if connected — never
    // blocks the booking itself, and failures on one leg don't stop the rest.
    for (const booking of bookings) {
      await pushBookingToCalendar(env, booking, "create");
    }

    if (lead_id) {
      await sbAdmin(env, `/leads?id=eq.${lead_id}&owner_id=eq.${user.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "ditukar", converted_booking_id: bookings[0].id, updated_at: new Date().toISOString() }),
      });
    }

    return json({ success: true, bookings });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
