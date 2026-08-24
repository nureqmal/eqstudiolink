// Cloudflare Pages Function — /api/admin-notices
// Password-gated (x-admin-key header).
// GET: list all notices (active + inactive + scheduled — admin sees everything).
// POST: create or update a notice. Body: { id? (omit to create), category, message,
//   cta_text?, cta_url?, is_active, is_dismissible, target_audience, target_location,
//   start_at?, end_at?, priority }
// Required Pages env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_DASHBOARD_KEY

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

const VALID_CATEGORIES = ["info", "warning", "success", "critical"];
const VALID_AUDIENCES = ["all", "trial", "starter", "pro"];
const VALID_LOCATIONS = ["landing", "dashboard", "both"];

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return json({ error: "Unauthorized" }, 401);

  try {
    const notices = await sbAdmin(env, "/notices?select=*&order=priority.desc,created_at.desc");
    return json({ notices });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await request.json();
    const { id, category, message, cta_text, cta_url, is_active, is_dismissible, target_audience, target_location, start_at, end_at, priority } = body;

    if (!VALID_CATEGORIES.includes(category)) return json({ error: "Kategori tidak sah." }, 400);
    if (!message || !message.trim()) return json({ error: "Mesej diperlukan." }, 400);
    if (!VALID_AUDIENCES.includes(target_audience)) return json({ error: "Target audience tidak sah." }, 400);
    if (!VALID_LOCATIONS.includes(target_location)) return json({ error: "Target location tidak sah." }, 400);
    if (start_at && end_at && new Date(start_at) > new Date(end_at)) return json({ error: "Tarikh mula tak boleh selepas tarikh tamat." }, 400);

    const payload = {
      category,
      message: message.trim(),
      cta_text: cta_text?.trim() || null,
      cta_url: cta_url?.trim() || null,
      is_active: !!is_active,
      is_dismissible: is_dismissible !== false,
      target_audience,
      target_location,
      start_at: start_at || null,
      end_at: end_at || null,
      priority: Number.isFinite(priority) ? priority : 0,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (id) {
      result = await sbAdmin(env, `/notices?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    } else {
      result = await sbAdmin(env, "/notices", { method: "POST", body: JSON.stringify(payload) });
    }

    return json({ notice: result[0] });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return json({ error: "Unauthorized" }, 401);

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "id diperlukan." }, 400);
    await sbAdmin(env, `/notices?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
