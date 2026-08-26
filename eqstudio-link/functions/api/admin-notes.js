// Cloudflare Pages Function — /api/admin-notes
// Password-gated (x-admin-key). GET: list notes for owner_id. POST: add a note.

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
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

function checkAuth(request, env) {
  const adminKey = request.headers.get("x-admin-key");
  return adminKey && adminKey === env.ADMIN_DASHBOARD_KEY;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return json({ error: "Unauthorized" }, 401);

  const url = new URL(request.url);
  const ownerId = url.searchParams.get("owner_id");
  if (!ownerId) return json({ error: "owner_id diperlukan." }, 400);

  try {
    const notes = await sbAdmin(env, `/admin_notes?owner_id=eq.${ownerId}&select=*&order=created_at.desc`);
    return json({ notes });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return json({ error: "Unauthorized" }, 401);

  try {
    const { owner_id, note } = await request.json();
    if (!owner_id || !note?.trim()) return json({ error: "owner_id dan note diperlukan." }, 400);

    const result = await sbAdmin(env, "/admin_notes", {
      method: "POST",
      body: JSON.stringify({ owner_id, note: note.trim() }),
    });
    return json({ note: result[0] });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
