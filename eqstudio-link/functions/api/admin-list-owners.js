// Cloudflare Pages Function — GET /api/admin-list-owners
// Password-gated (x-admin-key header, checked against ADMIN_DASHBOARD_KEY).
// Required Pages env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_DASHBOARD_KEY

async function sbAdmin(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const adminKey = request.headers.get("x-admin-key");
  if (!adminKey || adminKey !== env.ADMIN_DASHBOARD_KEY) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const [profiles, customers, bookings, bookingLinks, authUsersRes] = await Promise.all([
      sbAdmin(env, "/profiles?select=id,business_name,subscription_status,subscription_end_date,is_suspended,created_at,tier"),
      sbAdmin(env, "/customers?select=owner_id"),
      sbAdmin(env, "/bookings?select=owner_id,status"),
      sbAdmin(env, "/booking_links?select=owner_id,slug"),
      fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
      }).then(r => r.json()),
    ]);

    const emailById = new Map((authUsersRes.users || []).map(u => [u.id, u.email]));
    const customerCountByOwner = new Map();
    for (const c of customers) {
      customerCountByOwner.set(c.owner_id, (customerCountByOwner.get(c.owner_id) || 0) + 1);
    }
    const bookingCountByOwner = new Map();
    for (const b of bookings) {
      if (b.status !== "confirmed") continue;
      bookingCountByOwner.set(b.owner_id, (bookingCountByOwner.get(b.owner_id) || 0) + 1);
    }
    const linksByOwner = new Map();
    for (const l of bookingLinks) {
      if (!linksByOwner.has(l.owner_id)) linksByOwner.set(l.owner_id, []);
      linksByOwner.get(l.owner_id).push(l.slug);
    }

    const owners = profiles.map(p => ({
      id: p.id,
      email: emailById.get(p.id) || "—",
      business_name: p.business_name || "(belum diisi)",
      tier: p.tier || "starter",
      subscription_status: p.subscription_status,
      subscription_end_date: p.subscription_end_date,
      is_suspended: p.is_suspended,
      created_at: p.created_at,
      customer_count: customerCountByOwner.get(p.id) || 0,
      booking_slug: (linksByOwner.get(p.id) || [])[0] || null,
      booking_link_count: (linksByOwner.get(p.id) || []).length,
      booking_count: bookingCountByOwner.get(p.id) || 0,
    })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return json({ owners });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
