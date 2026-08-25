// Cloudflare Pages Function — POST /api/forum-admin-post
// Requires header: x-admin-key: <ADMIN_DASHBOARD_KEY>
// Body EITHER: { category_slug, title, message, is_pinned? }  → creates a new thread
//          OR: { thread_id, message }                          → replies to a thread
// Both posted as author_name "eqstudio.link Team", is_founder=true.
//
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_DASHBOARD_KEY

async function sbAdmin(env, path, options = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  return res;
}

const FOUNDER_NAME = "eqstudio.link Team";

export async function onRequestPost(context) {
  const { request, env } = context;
  const adminKey = request.headers.get("x-admin-key");
  if (!adminKey || adminKey !== env.ADMIN_DASHBOARD_KEY) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await request.json();

    if (body.thread_id) {
      // Reply to an existing thread
      if (!body.message?.trim()) return json({ error: "message diperlukan." }, 400);
      const insertRes = await sbAdmin(env, "/forum_replies", {
        method: "POST",
        body: JSON.stringify({ thread_id: body.thread_id, owner_id: null, author_name: FOUNDER_NAME, is_founder: true, message: body.message.trim() }),
      });
      if (!insertRes.ok) return json({ error: `Gagal reply: ${await insertRes.text()}` }, 502);
      await sbAdmin(env, `/forum_threads?id=eq.${body.thread_id}`, {
        method: "PATCH", prefer: "return=minimal",
        body: JSON.stringify({ last_activity_at: new Date().toISOString() }),
      });
      const inserted = await insertRes.json();
      return json({ success: true, data: inserted[0] });
    }

    // New thread
    if (!body.category_slug || !body.title?.trim() || !body.message?.trim()) {
      return json({ error: "category_slug, title, dan message diperlukan." }, 400);
    }
    const catRes = await sbAdmin(env, `/forum_categories?slug=eq.${encodeURIComponent(body.category_slug)}&select=id`);
    const categories = await catRes.json();
    if (categories.length === 0) return json({ error: "Kategori tidak dijumpai." }, 404);

    const insertRes = await sbAdmin(env, "/forum_threads", {
      method: "POST",
      body: JSON.stringify({
        category_id: categories[0].id, owner_id: null, author_name: FOUNDER_NAME, is_founder: true,
        is_pinned: !!body.is_pinned, title: body.title.trim(), message: body.message.trim(),
      }),
    });
    if (!insertRes.ok) return json({ error: `Gagal cipta thread: ${await insertRes.text()}` }, 502);
    const inserted = await insertRes.json();
    return json({ success: true, data: inserted[0] });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const adminKey = request.headers.get("x-admin-key");
  if (!adminKey || adminKey !== env.ADMIN_DASHBOARD_KEY) return json({ error: "Unauthorized" }, 401);

  try {
    const { thread_id, feature_status } = await request.json();
    if (!thread_id) return json({ error: "thread_id diperlukan." }, 400);
    const validStatuses = [null, "planned", "in_progress", "shipped"];
    if (!validStatuses.includes(feature_status)) return json({ error: "feature_status tidak sah." }, 400);

    const res = await sbAdmin(env, `/forum_threads?id=eq.${thread_id}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({ feature_status }),
    });
    if (!res.ok) return json({ error: `Gagal update status: ${await res.text()}` }, 502);
    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const adminKey = request.headers.get("x-admin-key");
  if (!adminKey || adminKey !== env.ADMIN_DASHBOARD_KEY) return json({ error: "Unauthorized" }, 401);

  const url = new URL(request.url);
  const threadId = url.searchParams.get("thread_id");
  if (!threadId) return json({ error: "thread_id diperlukan." }, 400);

  try {
    // Replies/reactions cascade-delete via FK on delete cascade (see forum schema).
    const res = await sbAdmin(env, `/forum_threads?id=eq.${threadId}`, { method: "DELETE", prefer: "return=minimal" });
    if (!res.ok) return json({ error: `Gagal padam thread: ${await res.text()}` }, 502);
    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
