// Cloudflare Pages Function — GET /api/admin-audit-log
// Password-gated (x-admin-key). Optional ?owner_id= to filter to one owner.

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

  try {
    const filter = ownerId ? `&target_owner_id=eq.${ownerId}` : "";
    const logs = await sbAdmin(env, `/admin_audit_log?select=*${filter}&order=created_at.desc&limit=200`);

    // Attach business_name for each distinct target_owner_id so the log is readable
    // without a separate lookup — skip nulls (some actions may have no target).
    const ownerIds = [...new Set(logs.map(l => l.target_owner_id).filter(Boolean))];
    let nameByOwner = new Map();
    if (ownerIds.length > 0) {
      const profs = await sbAdmin(env, `/profiles?id=in.(${ownerIds.join(",")})&select=id,business_name`);
      nameByOwner = new Map(profs.map(p => [p.id, p.business_name]));
    }
    const result = logs.map(l => ({ ...l, target_business_name: nameByOwner.get(l.target_owner_id) || null }));

    return json({ logs: result });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
