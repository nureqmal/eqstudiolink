// functions/api/google-calendar-callback.js
// ═══ VERSI DEBUG SEMENTARA ═══
// Papar mesej error PENUH dalam browser kalau gagal, supaya senang debug
// tanpa perlu gali Cloudflare dashboard logs. GANTI balik dengan versi asal
// (silent redirect) selepas isu ni selesai — versi debug ni dedah maklumat
// teknikal yang tak sepatutnya nampak kepada pengguna biasa.

import { encryptToken } from "../lib/token-crypto.js";

function debugErrorPage(step, err, extra = "") {
  const html = `<!doctype html><html><body style="font-family:monospace; padding:2rem; white-space:pre-wrap;">
<h2 style="color:red;">DEBUG: Gagal di langkah "${step}"</h2>
<p><strong>Mesej ralat:</strong> ${err?.message || String(err)}</p>
<p><strong>Stack:</strong></p>
<pre>${err?.stack || "(tiada stack trace)"}</pre>
${extra ? `<p><strong>Maklumat tambahan:</strong></p><pre>${extra}</pre>` : ""}
<p><a href="/dashboard.html">← Balik ke Dashboard</a></p>
</body></html>`;
  return new Response(html, { status: 500, headers: { "Content-Type": "text/html" } });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  let step = "init";

  try {
    step = "parse-url";
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    const dashboardUrl = (status) => `${url.origin}/dashboard.html?page=tetapan-profil&calendar=${status}`;

    if (errorParam) {
      return Response.redirect(dashboardUrl("cancelled"), 302);
    }
    if (!code || !stateRaw) {
      return debugErrorPage("check-params", new Error("code atau state tiada dalam URL"), `code=${code}, state=${stateRaw}`);
    }

    step = "parse-state";
    let ownerId;
    try {
      const state = JSON.parse(atob(stateRaw));
      ownerId = state.ownerId;
      if (!ownerId || Date.now() - state.ts > 10 * 60 * 1000) throw new Error("state expired atau ownerId tiada");
    } catch (err) {
      return debugErrorPage("parse-state", err, `stateRaw=${stateRaw}`);
    }

    step = "check-env-vars";
    const missingEnvVars = [];
    if (!env.GOOGLE_CALENDAR_CLIENT_ID) missingEnvVars.push("GOOGLE_CALENDAR_CLIENT_ID");
    if (!env.GOOGLE_CALENDAR_CLIENT_SECRET) missingEnvVars.push("GOOGLE_CALENDAR_CLIENT_SECRET");
    if (!env.SUPABASE_URL) missingEnvVars.push("SUPABASE_URL");
    if (!env.SUPABASE_SERVICE_ROLE_KEY) missingEnvVars.push("SUPABASE_SERVICE_ROLE_KEY");
    if (!env.CALENDAR_TOKEN_ENCRYPTION_KEY) missingEnvVars.push("CALENDAR_TOKEN_ENCRYPTION_KEY");
    if (missingEnvVars.length > 0) {
      return debugErrorPage("check-env-vars", new Error("Environment variable tiada/kosong"), missingEnvVars.join(", "));
    }

    step = "google-token-exchange";
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
      const errText = await tokenRes.text();
      return debugErrorPage("google-token-exchange", new Error(`Google respond status ${tokenRes.status}`), errText);
    }

    step = "parse-token-response";
    const tokenData = await tokenRes.json();
    if (!tokenData.refresh_token) {
      return debugErrorPage("check-refresh-token", new Error("Google tak bagi refresh_token"), JSON.stringify(tokenData, null, 2));
    }

    step = "encrypt-token";
    const encryptedRefreshToken = await encryptToken(env, tokenData.refresh_token);

    step = "compute-expiry";
    const accessTokenExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    step = "fetch-primary-calendar";
    const calListRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const calData = calListRes.ok ? await calListRes.json() : { id: "primary" };

    step = "save-to-supabase";
    const upsertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/google_calendar_connections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "resolution=merge-duplicates",
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
      const errText = await upsertRes.text();
      return debugErrorPage("save-to-supabase", new Error(`Supabase respond status ${upsertRes.status}`), errText);
    }

    return Response.redirect(dashboardUrl("connected"), 302);
  } catch (err) {
    return debugErrorPage(step, err);
  }
}
