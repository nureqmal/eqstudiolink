// Cloudflare Pages Function — POST /api/claim-payment
// Called by billing.html (with the owner's Supabase access token) after they
// manually bank-transfer to the eqstudio.link GXBank account. Sets a
// "pending verification" flag (payment_claimed_at) and emails the founder so
// they know to check the bank and manually upgrade via the admin panel.
//
// Required Pages env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   SUPABASE_ANON_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL, FOUNDER_NOTIFY_EMAIL

async function getUserFromToken(env, accessToken) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

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

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const user = await getUserFromToken(env, token);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { tier, amount } = await request.json();

    const now = new Date().toISOString();
    await sbAdmin(env, `/profiles?id=eq.${user.id}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({ payment_claimed_at: now }),
    });

    if (env.RESEND_API_KEY && env.FOUNDER_NOTIFY_EMAIL) {
      const profRes = await sbAdmin(env, `/profiles?id=eq.${user.id}&select=business_name`);
      const businessName = profRes[0]?.business_name || "(belum diisi)";
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: env.RESEND_FROM_EMAIL,
            to: env.FOUNDER_NOTIFY_EMAIL,
            subject: `💰 Bayaran Dituntut — ${businessName}`,
            html: `<p><strong>${escapeHtml(businessName)}</strong> (${escapeHtml(user.email)}) tuntut dah bayar RM${escapeHtml(amount)} untuk pelan ${escapeHtml(tier)}.</p><p>Sila semak akaun GXBank, lepas confirm, pergi ke <a href="${env.PUBLIC_SITE_URL || "https://eqstudio.link"}/admin.html">Admin Panel</a> untuk upgrade akaun mereka.</p>`,
          }),
        });
      } catch { /* notification is best-effort — the claim itself already succeeded */ }
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
