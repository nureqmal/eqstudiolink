// Cloudflare Pages Function — POST /api/admin-owner-action
// Password-gated (x-admin-key header). Body: { owner_id, action, days?, tier?, status? }
// action: 'suspend' | 'reactivate' | 'delete' | 'extend_subscription' | 'reset_password'
//       | 'change_tier' | 'set_subscription_status' | 'impersonate'
// Required Pages env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_DASHBOARD_KEY,
//   PUBLIC_SITE_URL, RESEND_API_KEY, RESEND_FROM_EMAIL

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function sendPaymentConfirmedEmail(env, ownerId, newEndDate) {
  if (!env.RESEND_API_KEY) return;
  try {
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${ownerId}`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    const userData = await userRes.json();
    if (!userData.email) return;
    const profRes = await sbAdmin(env, `/profiles?id=eq.${ownerId}&select=business_name,tier`);
    const bizName = profRes[0]?.business_name || "";
    const tier = profRes[0]?.tier === "pro" ? "Pro" : "Starter";
    const endLabel = newEndDate ? new Date(newEndDate).toLocaleDateString("ms-MY", { day: "numeric", month: "long", year: "numeric" }) : "";
    const site = env.PUBLIC_SITE_URL || "https://eqstudio.link";
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: userData.email,
        subject: "✅ Bayaran Disahkan — Pelan Anda Aktif",
        html: `<p>Salam${bizName ? " " + escapeHtml(bizName) : ""},</p><p>Bayaran anda telah <strong>disahkan</strong>. Pelan <strong>${tier}</strong> anda kini aktif${endLabel ? ` sehingga <strong>${endLabel}</strong>` : ""}.</p><p>Terima kasih kerana terus bersama eqstudio.link!</p><p><a href="${site}/dashboard.html">Pergi ke Dashboard →</a></p>`,
      }),
    });
  } catch { /* best-effort — the actual tier/status change already succeeded regardless */ }
}

async function sendPaymentRejectedEmail(env, ownerId) {
  if (!env.RESEND_API_KEY) return;
  try {
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${ownerId}`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    const userData = await userRes.json();
    if (!userData.email) return;
    const profRes = await sbAdmin(env, `/profiles?id=eq.${ownerId}&select=business_name`);
    const bizName = profRes[0]?.business_name || "";
    const site = env.PUBLIC_SITE_URL || "https://eqstudio.link";
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: userData.email,
        subject: "Bayaran Belum Kami Terima",
        html: `<p>Salam${bizName ? " " + escapeHtml(bizName) : ""},</p><p>Kami belum jumpa bayaran anda dalam akaun bank kami buat masa ni. Ini boleh berlaku sebab transfer belum selesai, atau mungkin tertekan butang secara tidak sengaja.</p><p>Sila semak dan cuba transfer semula, atau hubungi kami kalau anda rasa ini kesilapan.</p><p><a href="${site}/billing.html">Kembali ke Billing →</a></p>`,
      }),
    });
  } catch { /* best-effort — the flag clear already succeeded regardless */ }
}

async function sendFoundingMemberEmail(env, ownerId) {
  if (!env.RESEND_API_KEY) return;
  try {
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${ownerId}`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    const userData = await userRes.json();
    if (!userData.email) return;
    const profRes = await sbAdmin(env, `/profiles?id=eq.${ownerId}&select=business_name`);
    const bizName = profRes[0]?.business_name || "";
    const site = env.PUBLIC_SITE_URL || "https://eqstudio.link";
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: userData.email,
        subject: "🎉 Anda Founding Member eqstudio.link",
        html: `<p>Salam${bizName ? " " + escapeHtml(bizName) : ""},</p><p>Tahniah, anda adalah salah seorang daripada 50 Founding Member pertama eqstudio.link. Kadar RM15 sebulan (atau RM150 setahun) anda kini <strong>dikunci selama-lamanya</strong>, walaupun harga standard kami berubah kemudian.</p><p>Terima kasih kerana mempercayai kami dari peringkat awal.</p><p><a href="${site}/dashboard.html">Pergi ke Dashboard →</a></p>`,
      }),
    });
  } catch { /* best-effort — the actual grant already succeeded regardless */ }
}

// Called from any admin action that transitions an owner to active for the
// first time. Only actually grants Founding Member status if they stated
// that intent at claim time (wants_founding_member) AND a slot is still
// available — checked atomically via the RPC function (migration_fasa46),
// which fully serializes concurrent grant attempts so the 50-slot cap can
// never be exceeded regardless of how many verifications happen at once.
async function tryGrantFoundingMember(env, ownerId, wasFirstActivation) {
  if (!wasFirstActivation) return;
  try {
    const profRes = await sbAdmin(env, `/profiles?id=eq.${ownerId}&select=wants_founding_member,is_founding_member`, { prefer: "return=representation" });
    const prof = profRes[0];
    if (!prof || !prof.wants_founding_member || prof.is_founding_member) return;

    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/grant_founding_member_slot`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_owner_id: ownerId }),
    });
    const granted = await res.json();
    if (granted === true) {
      await logAuditAction(env, "founding_member_granted", ownerId, "Slot Founding Member diberikan (RM15/RM150 dikunci)");
      await sendFoundingMemberEmail(env, ownerId);
    }
  } catch (err) {
    // Never let a founding-member-grant failure block the actual payment
    // verification itself — that already succeeded by the time this runs.
    console.error("tryGrantFoundingMember failed:", err.message);
  }
}

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

async function logAuditAction(env, action, targetOwnerId, details) {
  try {
    await sbAdmin(env, "/admin_audit_log", {
      method: "POST",
      body: JSON.stringify({ action, target_owner_id: targetOwnerId, details: details || null }),
    });
  } catch (err) {
    // Logging failure must never block the actual admin action from succeeding.
    console.error("Audit log write failed:", err.message);
  }
}

const VALID_STATUSES = ["trialing", "active", "past_due", "cancelled"];

export async function onRequestPost(context) {
  const { request, env } = context;

  const adminKey = request.headers.get("x-admin-key");
  if (!adminKey || adminKey !== env.ADMIN_DASHBOARD_KEY) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const { owner_id, action, days, tier, status } = await request.json();
    if (!owner_id || !action) return json({ error: "owner_id dan action diperlukan." }, 400);

    if (action === "suspend") {
      await sbAdmin(env, `/profiles?id=eq.${owner_id}`, { method: "PATCH", body: JSON.stringify({ is_suspended: true }) });
      await logAuditAction(env, "suspend", owner_id);
      return json({ success: true });
    }

    if (action === "reactivate") {
      await sbAdmin(env, `/profiles?id=eq.${owner_id}`, { method: "PATCH", body: JSON.stringify({ is_suspended: false }) });
      await logAuditAction(env, "reactivate", owner_id);
      return json({ success: true });
    }

    if (action === "forum_ban") {
      await sbAdmin(env, `/profiles?id=eq.${owner_id}`, { method: "PATCH", body: JSON.stringify({ forum_banned: true }) });
      await logAuditAction(env, "forum_ban", owner_id);
      return json({ success: true });
    }

    if (action === "forum_unban") {
      await sbAdmin(env, `/profiles?id=eq.${owner_id}`, { method: "PATCH", body: JSON.stringify({ forum_banned: false }) });
      await logAuditAction(env, "forum_unban", owner_id);
      return json({ success: true });
    }

    if (action === "reject_payment_claim") {
      await sbAdmin(env, `/profiles?id=eq.${owner_id}`, { method: "PATCH", body: JSON.stringify({ payment_claimed_at: null }) });
      await sendPaymentRejectedEmail(env, owner_id);
      await logAuditAction(env, "reject_payment_claim", owner_id, "Tuntutan bayaran ditolak — duit belum diterima");
      return json({ success: true });
    }

    if (action === "extend_subscription") {
      const extendDays = parseInt(days, 10) || 30;
      const profRes = await sbAdmin(env, `/profiles?id=eq.${owner_id}&select=subscription_end_date,payment_claimed_at,subscription_status`, { prefer: "return=representation" });
      const wasClaimPending = !!profRes[0]?.payment_claimed_at;
      const wasFirstActivation = profRes[0]?.subscription_status !== "active";
      const current = profRes[0]?.subscription_end_date ? new Date(profRes[0].subscription_end_date) : new Date();
      const base = current > new Date() ? current : new Date();
      const newEnd = new Date(base.getTime() + extendDays * 24 * 60 * 60 * 1000);
      await sbAdmin(env, `/profiles?id=eq.${owner_id}`, {
        method: "PATCH",
        body: JSON.stringify({ subscription_status: "active", subscription_end_date: newEnd.toISOString(), payment_claimed_at: null }),
      });
      await tryGrantFoundingMember(env, owner_id, wasFirstActivation);
      if (wasClaimPending) await sendPaymentConfirmedEmail(env, owner_id, newEnd.toISOString());
      await logAuditAction(env, "extend_subscription", owner_id, `+${extendDays} hari, tamat baharu ${newEnd.toISOString().slice(0, 10)}`);
      return json({ success: true, new_end_date: newEnd.toISOString() });
    }

    if (action === "set_subscription_status") {
      if (!VALID_STATUSES.includes(status)) return json({ error: `status mesti salah satu: ${VALID_STATUSES.join(", ")}` }, 400);
      const payload = { subscription_status: status };
      let wasClaimPending = false;
      let wasFirstActivation = false;
      let currentEndDate = null;
      if (status === "active") {
        const profRes = await sbAdmin(env, `/profiles?id=eq.${owner_id}&select=payment_claimed_at,subscription_end_date,subscription_status`, { prefer: "return=representation" });
        wasClaimPending = !!profRes[0]?.payment_claimed_at;
        wasFirstActivation = profRes[0]?.subscription_status !== "active";
        currentEndDate = profRes[0]?.subscription_end_date;
        payload.payment_claimed_at = null;
      }
      await sbAdmin(env, `/profiles?id=eq.${owner_id}`, { method: "PATCH", body: JSON.stringify(payload) });
      if (status === "active") await tryGrantFoundingMember(env, owner_id, wasFirstActivation);
      if (wasClaimPending) await sendPaymentConfirmedEmail(env, owner_id, currentEndDate);
      await logAuditAction(env, "set_subscription_status", owner_id, `status ditukar ke ${status}`);
      return json({ success: true, subscription_status: status });
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
      await logAuditAction(env, "reset_password", owner_id, `link reset dijana untuk ${userData.email}`);
      return json({ success: true, reset_link: linkData.action_link, email: userData.email });
    }

    if (action === "impersonate") {
      const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${owner_id}`, {
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
      });
      const userData = await userRes.json();
      if (!userData.email) return json({ error: "Emel owner tidak dijumpai." }, 404);

      // Reuses the same generate_link mechanism as reset_password, but type "magiclink"
      // instead of "recovery" — this signs the admin straight into a real session AS
      // this owner when the link is opened, rather than sending them to a password-reset
      // flow. No custom session/token handling needed, Supabase's own auth flow does it.
      const linkRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "magiclink",
          email: userData.email,
          options: { redirect_to: `${env.PUBLIC_SITE_URL || "https://eqstudio.link"}/dashboard.html` },
        }),
      });
      if (!linkRes.ok) return json({ error: `Gagal jana link: ${await linkRes.text()}` }, 502);
      const linkData = await linkRes.json();
      await logAuditAction(env, "impersonate", owner_id, `admin login sebagai ${userData.email}`);
      return json({ success: true, impersonate_link: linkData.action_link, email: userData.email });
    }

    if (action === "change_tier") {
      if (tier !== "starter" && tier !== "pro") return json({ error: "tier mesti 'starter' atau 'pro'." }, 400);

      const profRes = await sbAdmin(env, `/profiles?id=eq.${owner_id}&select=subscription_status,subscription_end_date,payment_claimed_at`, { prefer: "return=representation" });
      const currentStatus = profRes[0]?.subscription_status;
      const currentEnd = profRes[0]?.subscription_end_date ? new Date(profRes[0].subscription_end_date) : null;
      const wasClaimPending = !!profRes[0]?.payment_claimed_at;

      const payload = { tier };
      if (currentStatus !== "active") {
        payload.subscription_status = "active";
        payload.payment_claimed_at = null;
        if (!currentEnd || currentEnd < new Date()) {
          payload.subscription_end_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        }
      }

      await sbAdmin(env, `/profiles?id=eq.${owner_id}`, { method: "PATCH", body: JSON.stringify(payload) });
      const wasFirstActivation = currentStatus !== "active";
      await tryGrantFoundingMember(env, owner_id, wasFirstActivation);
      if (wasClaimPending) await sendPaymentConfirmedEmail(env, owner_id, payload.subscription_end_date || currentEnd?.toISOString());
      await logAuditAction(env, "change_tier", owner_id, `tier ditukar ke ${tier}`);
      return json({ success: true, tier, subscription_status: payload.subscription_status || currentStatus });
    }

    if (action === "delete") {
      const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${owner_id}`, {
        method: "DELETE",
        headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
      });
      if (!res.ok) return json({ error: `Gagal padam: ${await res.text()}` }, 502);
      // profiles/customers/bills/reminder_settings/reminders_log/booking_links/bookings
      // all cascade-delete via "references auth.users(id) on delete cascade".
      await logAuditAction(env, "delete", owner_id);
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
