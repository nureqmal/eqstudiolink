// Cloudflare Pages Function — POST /api/admin-owner-action
// Password-gated (x-admin-key header). Body: { owner_id, action, days? }
// action: 'suspend' | 'reactivate' | 'delete' | 'extend_subscription' | 'reset_password'
// Required Pages env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_DASHBOARD_KEY, PUBLIC_SITE_URL

async function sbAdmin(env, path, options = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=minimal",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const adminKey = request.headers.get("x-admin-key");
  if (!adminKey || adminKey !== env.ADMIN_DASHBOARD_KEY) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const { owner_id, action, days } = await request.json();
    if (!owner_id || !action) return json({ error: "owner_id dan action diperlukan." }, 400);

    if (action === "suspend") {
      await sbAdmin(env, `/profiles?id=eq.${owner_id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_suspended: true }),
      });
      return json({ success: true });
    }

    if (action === "reactivate") {
      await sbAdmin(env, `/profiles?id=eq.${owner_id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_suspended: false }),
      });
      return json({ success: true });
    }

    if (action === "extend_subscription") {
      const extendDays = parseInt(days, 10) || 30;
      const profRes = await sbAdmin(env, `/profiles?id=eq.${owner_id}&select=subscription_end_date`, { prefer: "return=representation" });
      const current = profRes[0]?.subscription_end_date ? new Date(profRes[0].subscription_end_date) : new Date();
      const base = current > new Date() ? current : new Date();
      const newEnd = new Date(base.getTime() + extendDays * 24 * 60 * 60 * 1000);
      await sbAdmin(env, `/profiles?id=eq.${owner_id}`, {
        method: "PATCH",
        body: JSON.stringify({ subscription_status: "active", subscription_end_date: newEnd.toISOString() }),
      });
      return json({ success: true, new_end_date: newEnd.toISOString() });
    }

    if (action === "reset_password") {
      const profRes = await sbAdmin(env, `/profiles?id=eq.${owner_id}&select=id`, { prefer: "return=representation" });
      if (!profRes[0]) return json({ error: "Owner tidak dijumpai." }, 404);

      const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${owner_id}`, {
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
      });
      const userData = await userRes.json();
      if (!userData.email) return json({ error: "Emel owner tidak dijumpai." }, 404);

      const linkRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "recovery",
          email: userData.email,
          options: { redirect_to: `${env.PUBLIC_SITE_URL || "https://eqstudio.link"}/login.html` },
        }),
      });
      if (!linkRes.ok) return json({ error: `Gagal jana link: ${await linkRes.text()}` }, 502);
      const linkData = await linkRes.json();
      return json({ success: true, reset_link: linkData.action_link, email: userData.email });
    }

    if (action === "delete") {
      const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${owner_id}`, {
        method: "DELETE",
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
      });
      if (!res.ok) return json({ error: `Gagal padam: ${await res.text()}` }, 502);
      // profiles/customers/bills/reminder_settings/reminders_log all cascade-delete
      // via "references auth.users(id) on delete cascade" — no manual cleanup needed.
      return json({ success: true });
    }

    return json({ error: "Action tidak dikenali." }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
