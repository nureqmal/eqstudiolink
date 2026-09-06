// Cloudflare Pages Function — POST /api/resend-webhook
// Receives delivery lifecycle events from Resend (delivered, bounced,
// complained, opened, delivery_delayed) and updates the matching
// reminders_log / email_send_log row so owners can see REAL delivery
// status, not just "we successfully called the Resend API".
//
// Configure in the Resend dashboard: Webhooks → Add Endpoint →
//   https://eqstudio.link/api/resend-webhook
// Copy the signing secret (starts with whsec_) into the Pages env var
// RESEND_WEBHOOK_SECRET.
//
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_WEBHOOK_SECRET

const REPLAY_WINDOW_SECONDS = 5 * 60; // Resend/Svix's own replay tolerance

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSha256Base64(secretBytes, message) {
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sig);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Verifies a Resend/Svix-signed webhook. Returns true only if the request
// is genuinely from Resend, the timestamp is recent (anti-replay), and at
// least one of the (possibly multiple, space-separated) signatures matches.
async function verifySvixSignature(rawBody, headers, webhookSecret) {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const tsSeconds = parseInt(svixTimestamp, 10);
  if (!Number.isFinite(tsSeconds) || Math.abs(nowSeconds - tsSeconds) > REPLAY_WINDOW_SECONDS) return false;

  if (!webhookSecret.startsWith("whsec_")) return false;
  const secretBytes = base64ToUint8Array(webhookSecret.slice("whsec_".length));

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expectedSig = await hmacSha256Base64(secretBytes, signedContent);

  // svix-signature can carry multiple space-separated "v1,<base64>" values —
  // any single match is valid.
  const providedSigs = svixSignature.split(" ").map(s => s.startsWith("v1,") ? s.slice(3) : s);
  return providedSigs.includes(expectedSig);
}

async function sbAdmin(env, path, options = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=minimal",
      ...(options.headers || {}),
    },
  });
  return res;
}

// Maps Resend event types to our internal delivery_status values.
const EVENT_TO_STATUS = {
  "email.delivered": "delivered",
  "email.delivery_delayed": "delivery_delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
};

export async function onRequestPost(context) {
  const { request, env } = context;

  const rawBody = await request.text();
  const isValid = await verifySvixSignature(rawBody, request.headers, env.RESEND_WEBHOOK_SECRET || "");
  if (!isValid) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const eventType = payload?.type;
  const resendEmailId = payload?.data?.email_id;
  const newStatus = EVENT_TO_STATUS[eventType];

  // Unrecognized event types (e.g. email.sent, email.clicked) are ignored —
  // "sent" is already recorded at send time, and we don't currently surface
  // click-through data anywhere.
  if (!newStatus || !resendEmailId) {
    return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200 });
  }

  const updatePayload = { delivery_status: newStatus, delivery_status_updated_at: new Date().toISOString() };

  // Update both tables — a given resend_email_id will only exist in one of
  // them depending on the email type, so both calls are safe no-ops otherwise.
  await Promise.all([
    sbAdmin(env, `/reminders_log?resend_email_id=eq.${encodeURIComponent(resendEmailId)}`, {
      method: "PATCH",
      body: JSON.stringify(updatePayload),
    }),
    sbAdmin(env, `/email_send_log?resend_email_id=eq.${encodeURIComponent(resendEmailId)}`, {
      method: "PATCH",
      body: JSON.stringify(updatePayload),
    }),
  ]);

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
