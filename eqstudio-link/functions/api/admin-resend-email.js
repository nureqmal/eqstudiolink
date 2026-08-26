// Cloudflare Pages Function — POST /api/admin-resend-email
// Password-gated (x-admin-key). Body: { customer_id }
// Thin admin-authenticated proxy to the Worker cron's single-customer mode —
// same mechanism as trigger-instant-reminder.js, but callable for ANY owner's
// customer (admin support use case), not just the logged-in owner's own.
//
// Required Pages env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   ADMIN_DASHBOARD_KEY, WORKER_CRON_URL, MANUAL_TRIGGER_KEY

async function sbAdmin(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status}`);
  return res.json();
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const adminKey = request.headers.get("x-admin-key");
  if (!adminKey || adminKey !== env.ADMIN_DASHBOARD_KEY) return json({ error: "Unauthorized" }, 401);

  try {
    const { customer_id } = await request.json();
    if (!customer_id) return json({ error: "customer_id diperlukan." }, 400);

    const rows = await sbAdmin(env, `/customers?id=eq.${customer_id}&select=id`);
    if (!rows[0]) return json({ error: "Customer tidak dijumpai." }, 404);

    if (!env.WORKER_CRON_URL || !env.MANUAL_TRIGGER_KEY) {
      return json({ error: "WORKER_CRON_URL / MANUAL_TRIGGER_KEY belum diset dalam Pages env vars." }, 500);
    }

    const triggerUrl = `${env.WORKER_CRON_URL}/?key=${encodeURIComponent(env.MANUAL_TRIGGER_KEY)}&run=single&customer_id=${encodeURIComponent(customer_id)}`;
    const triggerRes = await fetch(triggerUrl);
    if (!triggerRes.ok) return json({ error: `Worker gagal hantar: ${await triggerRes.text()}` }, 502);

    try {
      await fetch(`${env.SUPABASE_URL}/rest/v1/admin_audit_log`, {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ action: "resend_email", details: `customer_id ${customer_id}` }),
      });
    } catch { /* logging is best-effort */ }

    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
