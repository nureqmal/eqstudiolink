// functions/api/google-calendar-disconnect.js
// Owner klik "Putuskan Sambungan" — padam row connection dan (cuba) revoke
// token di pihak Google supaya akses benar-benar mati.

import { decryptToken } from "../lib/token-crypto.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const authHeader = request.headers.get("Authorization") || "";
  const accessToken = authHeader.replace("Bearer ", "");
  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Sila log masuk dahulu." }), { status: 401 });
  }

  const authRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!authRes.ok) {
    return new Response(JSON.stringify({ error: "Sesi tidak sah." }), { status: 401 });
  }
  const userData = await authRes.json();
  const ownerId = userData.id;

  // Dapatkan refresh_token dahulu untuk cuba revoke di pihak Google (best-effort)
  const getRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/google_calendar_connections?owner_id=eq.${ownerId}&select=refresh_token`,
    { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
  );
  const rows = getRes.ok ? await getRes.json() : [];

  if (rows.length > 0) {
    try {
      const refreshToken = await decryptToken(env, rows[0].refresh_token);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: "POST" });
    } catch (err) {
      // Revoke gagal bukan sebab untuk halang disconnect — log sahaja dan teruskan
      console.error("Token revoke failed (non-fatal):", err.message);
    }
  }

  const delRes = await fetch(`${env.SUPABASE_URL}/rest/v1/google_calendar_connections?owner_id=eq.${ownerId}`, {
    method: "DELETE",
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });

  if (!delRes.ok) {
    return new Response(JSON.stringify({ error: "Gagal putuskan sambungan. Cuba lagi." }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}
