// Cloudflare Pages Function — GET /api/forum-thread-detail?id=<thread_id>
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
  const id = url.searchParams.get("id");
  if (!id) return new Response(JSON.stringify({ error: "id diperlukan." }), { status: 400, headers: { "content-type": "application/json" } });

  try {
    const threads = await sbAdmin(env, `/forum_threads?id=eq.${id}&select=*`);
    if (threads.length === 0) return new Response(JSON.stringify({ error: "Thread tidak dijumpai." }), { status: 404, headers: { "content-type": "application/json" } });

    const replies = await sbAdmin(env, `/forum_replies?thread_id=eq.${id}&select=*&order=created_at.asc`);
    const reactions = await sbAdmin(env, `/forum_reactions?thread_id=eq.${id}&select=owner_id`);

    // Attach each author's tier (for a "Pro" badge) — skip null owner_ids (founder posts).
    const ownerIds = [...new Set([threads[0].owner_id, ...replies.map(r => r.owner_id)].filter(Boolean))];
    let tierByOwner = new Map();
    if (ownerIds.length > 0) {
      const profs = await sbAdmin(env, `/profiles?id=in.(${ownerIds.join(",")})&select=id,tier`);
      tierByOwner = new Map(profs.map(p => [p.id, p.tier]));
    }
    const thread = { ...threads[0], author_tier: tierByOwner.get(threads[0].owner_id) || null };
    const repliesWithTier = replies.map(r => ({ ...r, author_tier: tierByOwner.get(r.owner_id) || null }));

    return new Response(JSON.stringify({ thread, replies: repliesWithTier, reaction_count: reactions.length, reactor_ids: reactions.map(r => r.owner_id) }), { headers: { "content-type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
