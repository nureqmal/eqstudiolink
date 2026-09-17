// functions/api/google-calendar-callback.js
// Google redirect ke sini selepas owner benarkan akses. Tukar "code" kepada
// access_token + refresh_token, simpan (refresh_token disulitkan), redirect
// owner balik ke dashboard.

import { encryptToken } from "../lib/token-crypto.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const dashboardUrl = (status) => `${url.origin}/dashboard.html?page=tetapan-profil&calendar=${status}`;

  if (errorParam) {
    // Owner tekan "Batal" di skrin kebenaran Google — bukan ralat sebenar
    return Response.redirect(dashboardUrl("cancelled"), 302);
  }
  if (!code || !stateRaw) {
    return Response.redirect(dashboardUrl("error"), 302);
  }

  let ownerId;
  try {
    const state = JSON.parse(atob(stateRaw));
    ownerId = state.ownerId;
    // Tolak state lapuk (lebih 10 minit) — elak replay attack
    if (!ownerId || Date.now() - state.ts > 10 * 60 * 1000) throw new Error("state expired");
  } catch {
    return Response.redirect(dashboardUrl("error"), 302);
  }

  // Tukar authorization code kepada token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/google-calendar-callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("Google token exchange failed:", await tokenRes.text());
    return Response.redirect(dashboardUrl("error"), 302);
  }

  const tokenData = await tokenRes.json();
  if (!tokenData.refresh_token) {
    // Google tak bagi refresh_token — biasanya sebab owner dah pernah connect
    // sebelum ni dan "prompt=consent" tak paksa dia betul-betul. Minta cuba lagi.
    return Response.redirect(dashboardUrl("no_refresh_token"), 302);
  }

  const encryptedRefreshToken = await encryptToken(env, tokenData.refresh_token);
  const accessTokenExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

  // Dapatkan kalendar "primary" owner untuk simpan google_calendar_id
  const calListRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const calData = calListRes.ok ? await calListRes.json() : { id: "primary" };

  const upsertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/google_calendar_connections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "resolution=merge-duplicates", // upsert berdasarkan unique constraint pada owner_id
    },
    body: JSON.stringify({
      owner_id: ownerId,
      google_calendar_id: calData.id || "primary",
      refresh_token: encryptedRefreshToken,
      access_token: tokenData.access_token,
      access_token_expires_at: accessTokenExpiresAt,
      last_sync_error: null,
    }),
  });

  if (!upsertRes.ok) {
    console.error("Failed to save calendar connection:", await upsertRes.text());
    return Response.redirect(dashboardUrl("error"), 302);
  }

  return Response.redirect(dashboardUrl("connected"), 302);
}
