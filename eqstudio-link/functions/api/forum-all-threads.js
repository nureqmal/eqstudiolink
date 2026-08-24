// Cloudflare Pages Function — GET /api/forum-all-threads
// Public (no auth). Returns every thread across every category in one payload,
// tagged with its category, for the unified feed + search/filter view.
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

async function sbAdmin(env, path) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const categories = await sbAdmin(env, "/forum_categories?select=*&order=sort_order.asc");
    const threads = await sbAdmin(env, "/forum_threads?select=*&order=is_pinned.desc,last_activity_at.desc");
    const replies = await sbAdmin(env, "/forum_replies?select=thread_id");
    const reactions = await sbAdmin(env, "/forum_reactions?select=thread_id");

    const replyCountByThread = new Map();
    for (const r of replies) replyCountByThread.set(r.thread_id, (replyCountByThread.get(r.thread_id) || 0) + 1);
    const reactionCountByThread = new Map();
    for (const r of reactions) reactionCountByThread.set(r.thread_id, (reactionCountByThread.get(r.thread_id) || 0) + 1);
    const catById = new Map(categories.map(c => [c.id, c]));

    const ownerIds = [...new Set(threads.map(t => t.owner_id).filter(Boolean))];
    let tierByOwner = new Map();
    if (ownerIds.length > 0) {
      const profs = await sbAdmin(env, `/profiles?id=in.(${ownerIds.join(",")})&select=id,tier`);
      tierByOwner = new Map(profs.map(p => [p.id, p.tier]));
    }

    const result = threads.map(t => ({
      ...t,
      reply_count: replyCountByThread.get(t.id) || 0,
      reaction_count: reactionCountByThread.get(t.id) || 0,
      category_slug: catById.get(t.category_id)?.slug || null,
      category_name: catById.get(t.category_id)?.name || null,
      author_tier: tierByOwner.get(t.owner_id) || null,
    }));

    return new Response(JSON.stringify({ categories, threads: result }), { headers: { "content-type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
