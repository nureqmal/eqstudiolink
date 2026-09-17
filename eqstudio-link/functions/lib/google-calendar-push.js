// functions/lib/google-calendar-push.js
// Fungsi dikongsi dipanggil dari booking create/reschedule/cancel endpoints.
// Reka bentuk: kegagalan di sini TIDAK PERNAH gagalkan booking itu sendiri —
// booking ialah sumber kebenaran (source of truth), Google Calendar cuma "cermin".

import { decryptToken } from "./token-crypto.js";

async function getValidAccessToken(env, connection) {
  const notExpiredYet = connection.access_token_expires_at &&
    new Date(connection.access_token_expires_at).getTime() > Date.now() + 60_000; // buffer 1 minit

  if (connection.access_token && notExpiredYet) {
    return connection.access_token;
  }

  // Token dah luput (atau hampir) — refresh guna refresh_token
  const refreshToken = await decryptToken(env, connection.refresh_token);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal refresh access token: ${errText}`);
  }

  const data = await res.json();
  const newExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

  // Simpan access_token baharu supaya panggilan seterusnya tak perlu refresh lagi
  await fetch(`${env.SUPABASE_URL}/rest/v1/google_calendar_connections?owner_id=eq.${connection.owner_id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ access_token: data.access_token, access_token_expires_at: newExpiresAt }),
  });

  return data.access_token;
}

function buildEventBody(booking) {
  const startIso = booking.slot_datetime;
  const endIso = new Date(new Date(startIso).getTime() + (booking.duration_minutes || 60) * 60_000).toISOString();
  return {
    summary: `Tempahan: ${booking.customer_name}`,
    description: [
      booking.customer_phone ? `Telefon: ${booking.customer_phone}` : null,
      booking.customer_notes ? `Nota: ${booking.customer_notes}` : null,
      `Rujukan: eqstudio.link booking #${booking.id.slice(0, 8)}`,
    ].filter(Boolean).join("\n"),
    start: { dateTime: startIso },
    end: { dateTime: endIso },
  };
}

/**
 * @param {object} env - Cloudflare Pages Function env (secrets/bindings)
 * @param {object} booking - row dari table `bookings` (perlu: id, owner_id, customer_name,
 *   customer_phone, customer_notes, slot_datetime, duration_minutes, google_event_id)
 * @param {"create"|"update"|"delete"} action
 */
export async function pushBookingToCalendar(env, booking, action) {
  try {
    const connRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/google_calendar_connections?owner_id=eq.${booking.owner_id}&select=*`,
      { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
    );
    const connections = connRes.ok ? await connRes.json() : [];
    if (connections.length === 0) return; // Owner tak sambung Google Calendar — skip senyap, bukan ralat

    const connection = connections[0];
    const accessToken = await getValidAccessToken(env, connection);
    const calendarId = encodeURIComponent(connection.google_calendar_id || "primary");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };

    let googleRes;
    let newEventId = booking.google_event_id;

    if (action === "delete") {
      if (!booking.google_event_id) return; // tiada event untuk dipadam
      googleRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${booking.google_event_id}`,
        { method: "DELETE", headers }
      );
      // 410 Gone = event dah dipadam manual oleh owner sebelum ni — anggap berjaya
      if (!googleRes.ok && googleRes.status !== 410 && googleRes.status !== 404) {
        throw new Error(`Google delete event gagal: ${await googleRes.text()}`);
      }
      newEventId = null;
    } else if (action === "update" && booking.google_event_id) {
      googleRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${booking.google_event_id}`,
        { method: "PATCH", headers, body: JSON.stringify(buildEventBody(booking)) }
      );
      if (!googleRes.ok) throw new Error(`Google update event gagal: ${await googleRes.text()}`);
    } else {
      // "create", atau "update" tapi tiada google_event_id sedia ada (fallback ke create)
      googleRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
        method: "POST", headers, body: JSON.stringify(buildEventBody(booking)),
      });
      if (!googleRes.ok) throw new Error(`Google create event gagal: ${await googleRes.text()}`);
      const created = await googleRes.json();
      newEventId = created.id;
    }

    // Simpan google_event_id balik ke booking (untuk update/delete masa depan)
    if (newEventId !== booking.google_event_id) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/bookings?id=eq.${booking.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ google_event_id: newEventId }),
      });
    }

    // Clear sebarang ralat lama, tanda sync berjaya
    await fetch(`${env.SUPABASE_URL}/rest/v1/google_calendar_connections?owner_id=eq.${booking.owner_id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ last_sync_error: null, last_sync_at: new Date().toISOString() }),
    });
  } catch (err) {
    // PENTING: never throw — booking flow mesti teruskan walau calendar push gagal.
    console.error("pushBookingToCalendar failed:", err.message);
    try {
      await fetch(`${env.SUPABASE_URL}/rest/v1/google_calendar_connections?owner_id=eq.${booking.owner_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ last_sync_error: err.message, last_sync_at: new Date().toISOString() }),
      });
    } catch { /* even error-logging failed — give up silently, not worth crashing over */ }
  }
}
