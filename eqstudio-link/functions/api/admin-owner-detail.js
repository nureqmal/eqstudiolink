// Cloudflare Pages Function — GET /api/admin-owner-detail?owner_id=<uuid>
// Password-gated (x-admin-key). Full activity snapshot for one owner.
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_DASHBOARD_KEY

async function sbAdmin(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const adminKey = request.headers.get("x-admin-key");
  if (!adminKey || adminKey !== env.ADMIN_DASHBOARD_KEY) return json({ error: "Unauthorized" }, 401);

  const url = new URL(request.url);
  const ownerId = url.searchParams.get("owner_id");
  if (!ownerId) return json({ error: "owner_id diperlukan." }, 400);

  try {
    const [profiles, bookingLinks, bookings, customers, forumThreads, forumReplies, authUsersRes] = await Promise.all([
      sbAdmin(env, `/profiles?id=eq.${ownerId}&select=*`),
      sbAdmin(env, `/booking_links?owner_id=eq.${ownerId}&select=*`),
      sbAdmin(env, `/bookings?owner_id=eq.${ownerId}&select=id,slot_datetime,customer_name,status,created_at&order=created_at.desc&limit=20`),
      sbAdmin(env, `/customers?owner_id=eq.${ownerId}&select=id,name,amount,status,due_date,paid_at&order=due_date.desc&limit=20`),
      sbAdmin(env, `/forum_threads?owner_id=eq.${ownerId}&select=id,title,created_at`),
      sbAdmin(env, `/forum_replies?owner_id=eq.${ownerId}&select=id,created_at`),
      fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
      }).then(r => r.json()),
    ]);

    const profile = profiles[0];
    if (!profile) return json({ error: "Owner tidak dijumpai." }, 404);
    const email = (authUsersRes.users || []).find(u => u.id === ownerId)?.email || "—";

    const totalPaid = customers.filter(c => c.status === "dah_bayar").reduce((sum, c) => sum + Number(c.amount), 0);
    const totalOutstanding = customers.filter(c => c.status !== "dah_bayar").reduce((sum, c) => sum + Number(c.amount), 0);

    return json({
      profile: { ...profile, email },
      booking_links: bookingLinks,
      recent_bookings: bookings,
      recent_customers: customers,
      forum_thread_count: forumThreads.length,
      forum_reply_count: forumReplies.length,
      total_paid: totalPaid,
      total_outstanding: totalOutstanding,
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
