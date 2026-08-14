// Cloudflare Pages Function — GET /api/admin-stats
// Requires header:  x-admin-key: <ADMIN_DASHBOARD_KEY>
// Set these as Pages environment variables/secrets (Cloudflare dashboard >
// Pages project > Settings > Environment variables):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_DASHBOARD_KEY

export async function onRequestGet(context) {
  const { request, env } = context;

  const adminKey = request.headers.get("x-admin-key");
  if (!adminKey || adminKey !== env.ADMIN_DASHBOARD_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };

  const base = env.SUPABASE_URL;

  const [usersRes, customersRes, remindersRes, paidRes] = await Promise.all([
    fetch(`${base}/rest/v1/profiles?select=id`, { headers: { ...headers, Prefer: "count=exact" } }),
    fetch(`${base}/rest/v1/customers?select=id`, { headers: { ...headers, Prefer: "count=exact" } }),
    fetch(`${base}/rest/v1/reminders_log?select=id`, { headers: { ...headers, Prefer: "count=exact" } }),
    fetch(`${base}/rest/v1/customers?select=id&status=eq.dah_bayar`, { headers: { ...headers, Prefer: "count=exact" } }),
  ]);

  const countFrom = (res) => {
    const range = res.headers.get("content-range"); // e.g. "0-9/42"
    return range ? parseInt(range.split("/")[1], 10) : null;
  };

  const stats = {
    total_users: countFrom(usersRes),
    total_customers_tracked: countFrom(customersRes),
    total_reminders_sent: countFrom(remindersRes),
    total_paid: countFrom(paidRes),
    checked_at: new Date().toISOString(),
  };

  return new Response(JSON.stringify(stats), {
    headers: { "content-type": "application/json" },
  });
}
