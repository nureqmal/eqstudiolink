// Cloudflare Pages Function — POST /api/trigger-instant-reminder
// Called right after the owner adds a customer with due_date <= today, so the
// reminder (if it matches their schedule) goes out immediately instead of
// waiting for the next ~9am cron run.
//
// This is a thin authenticated proxy to the Worker cron's own single-customer
// mode — the Worker already owns all the sending logic (branded email with
// bank transfer details, PDF, logging), so we call into it rather than
// duplicating that here.
//
// Required Pages environment variables/secrets:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//   WORKER_CRON_URL      (e.g. https://eqstudio-link-reminder-cron.<subdomain>.workers.dev)
//   MANUAL_TRIGGER_KEY   (same value as the Worker cron secret of the same name)

async function getUserFromToken(env, accessToken) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function sbAdmin(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status}`);
  return res.json();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sila log masuk semula." }, 401);
    const user = await getUserFromToken(env, token);
    if (!user?.id) return json({ error: "Sesi tidak sah." }, 401);

    const { customer_id } = await request.json();
    if (!customer_id) return json({ error: "customer_id diperlukan." }, 400);

    // Ownership check — never let one owner trigger a send for another owner's customer
    const rows = await sbAdmin(env, `/customers?id=eq.${customer_id}&owner_id=eq.${user.id}&select=id`);
    if (rows.length === 0) return json({ error: "Pelanggan tidak dijumpai." }, 404);

    if (!env.WORKER_CRON_URL || !env.MANUAL_TRIGGER_KEY) {
      // Not configured — fail quietly so customer creation still succeeds; they'll
      // just get the reminder on the next daily cron instead of instantly.
      return json({ sent: false, reason: "not_configured" });
    }

    const triggerUrl = `${env.WORKER_CRON_URL}/?key=${encodeURIComponent(env.MANUAL_TRIGGER_KEY)}&run=single&customer_id=${encodeURIComponent(customer_id)}`;
    const res = await fetch(triggerUrl);
    const result = await res.json();
    return json(result);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
