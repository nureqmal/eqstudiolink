// Cloudflare Pages Function — GET /api/forum-categories
// Public (no auth). Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

async function sbAdmin(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const categories = await sbAdmin(env, "/forum_categories?select=*&order=sort_order.asc");
    const threads = await sbAdmin(env, "/forum_threads?select=category_id");
    const countByCategory = new Map();
    for (const t of threads) countByCategory.set(t.category_id, (countByCategory.get(t.category_id) || 0) + 1);

    const result = categories.map(c => ({ ...c, thread_count: countByCategory.get(c.id) || 0 }));
    return new Response(JSON.stringify({ categories: result }), { headers: { "content-type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
