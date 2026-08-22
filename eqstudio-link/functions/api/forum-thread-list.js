// Cloudflare Pages Function — GET /api/forum-thread-list?category=<slug>
// Public (no auth). Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

async function sbAdmin(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get("category");
  if (!slug) return new Response(JSON.stringify({ error: "category diperlukan." }), { status: 400, headers: { "content-type": "application/json" } });

  try {
    const cats = await sbAdmin(env, `/forum_categories?slug=eq.${encodeURIComponent(slug)}&select=*`);
    if (cats.length === 0) return new Response(JSON.stringify({ error: "Kategori tidak dijumpai." }), { status: 404, headers: { "content-type": "application/json" } });
    const category = cats[0];

    const threads = await sbAdmin(env, `/forum_threads?category_id=eq.${category.id}&select=*&order=is_pinned.desc,last_activity_at.desc`);
    const replies = await sbAdmin(env, `/forum_replies?select=thread_id`);
    const replyCountByThread = new Map();
    for (const r of replies) replyCountByThread.set(r.thread_id, (replyCountByThread.get(r.thread_id) || 0) + 1);

    const reactions = await sbAdmin(env, `/forum_reactions?select=thread_id`);
    const reactionCountByThread = new Map();
    for (const r of reactions) reactionCountByThread.set(r.thread_id, (reactionCountByThread.get(r.thread_id) || 0) + 1);

    const result = threads.map(t => ({ ...t, reply_count: replyCountByThread.get(t.id) || 0, reaction_count: reactionCountByThread.get(t.id) || 0 }));
    return new Response(JSON.stringify({ category, threads: result }), { headers: { "content-type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
