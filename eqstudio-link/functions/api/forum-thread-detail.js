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
    return new Response(JSON.stringify({ thread: threads[0], replies }), { headers: { "content-type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
