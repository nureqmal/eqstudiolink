// Cloudflare Pages Function — POST /api/send-receipt-email
// Owner-triggered (manual) "Terima kasih, bayaran diterima" email.
// Required Pages environment variables/secrets:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL

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
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status}`);
  return res.status === 204 ? null : res.json();
}

function escapeHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Note: zh/ta are AI-generated translations — recommend native-speaker review before go-live.
const THANK_YOU_I18N = {
  ms: { title: (n) => `Terima kasih, ${n}!`, msg: (a) => `Bayaran <strong>RM ${a}</strong> anda telah kami terima.`, footer: "Kami hargai kepercayaan anda — sehingga urusan seterusnya! 🙏", subject: "Terima kasih — bayaran anda telah diterima", sentBy: (b) => `Dihantar oleh ${b} melalui eqstudio.link` },
  en: { title: (n) => `Thank you, ${n}!`, msg: (a) => `We've received your payment of <strong>RM ${a}</strong>.`, footer: "We appreciate your trust — see you next time! 🙏", subject: "Thank you — your payment has been received", sentBy: (b) => `Sent by ${b} via eqstudio.link` },
  zh: { title: (n) => `谢谢您，${n}！`, msg: (a) => `我们已收到您的 <strong>RM ${a}</strong> 付款。`, footer: "感谢您的信任 — 下次再见！🙏", subject: "谢谢 — 您的付款已收到", sentBy: (b) => `由 ${b} 通过 eqstudio.link 发送` },
  ta: { title: (n) => `நன்றி, ${n}!`, msg: (a) => `உங்கள் <strong>RM ${a}</strong> கட்டணத்தை நாங்கள் பெற்றுள்ளோம்.`, footer: "உங்கள் நம்பிக்கைக்கு நன்றி — அடுத்த முறை சந்திப்போம்! 🙏", subject: "நன்றி — உங்கள் கட்டணம் பெறப்பட்டது", sentBy: (b) => `${b} ஆல் eqstudio.link வழியாக அனுப்பப்பட்டது` },
};

async function sendEmail(env, { to, replyTo, subject, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to, reply_to: replyTo || undefined, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend send failed (${res.status}): ${(await res.text()).slice(0, 400)}`);
}

async function logEmailAttempt(env, { ownerId, recipient, subject, status, errorMessage }) {
  try {
    await sbAdmin(env, "/email_send_log", {
      method: "POST",
      prefer: "return=minimal",
      body: JSON.stringify({
        owner_id: ownerId || null,
        recipient,
        subject: subject?.slice(0, 200) || null,
        email_type: "receipt",
        status,
        error_message: errorMessage ? String(errorMessage).slice(0, 1000) : null,
      }),
    });
  } catch { /* never let logging break the request */ }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sila log masuk semula." }, 401);

    const user = await getUserFromToken(env, token);
    if (!user?.id) return json({ error: "Sesi tidak sah." }, 401);

    const { customer_id } = await request.json();
    if (!customer_id) return json({ error: "customer_id diperlukan." }, 400);

    const customers = await sbAdmin(env, `/customers?id=eq.${customer_id}&owner_id=eq.${user.id}&select=*`);
    const customer = customers[0];
    if (!customer) return json({ error: "Pelanggan tidak dijumpai." }, 404);

    const profiles = await sbAdmin(env, `/profiles?id=eq.${user.id}&select=business_name,contact_phone,contact_email,brand_color,logo_url`);
    const profile = profiles[0] || {};
    const bizName = profile.business_name?.trim() || "eqstudio.link";
    const brandColor = profile.brand_color || "#E8834E";

    const logoBlock = profile.logo_url
      ? `<img src="${escapeHtml(profile.logo_url)}" alt="${escapeHtml(bizName)}" style="max-height:44px; display:block; margin:0 auto 12px;" />`
      : `<div style="font-family:Georgia,serif; font-size:19px; font-weight:600; color:#1F3A34; text-align:center; margin-bottom:12px;">${escapeHtml(bizName)}</div>`;

    const T = THANK_YOU_I18N[customer.preferred_language] || THANK_YOU_I18N.ms;
    const amount = Number(customer.amount).toFixed(2);

    const html = `
<!doctype html><html><body style="margin:0; padding:0; background:#F1EADA; font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EADA; padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px; background:#FBF7EF; border-radius:10px; overflow:hidden; border:1px solid #E8DFCB;" cellpadding="0" cellspacing="0">
        <tr><td style="height:5px; background:${brandColor}; line-height:5px; font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:28px 32px 8px;">${logoBlock}</td></tr>
        <tr><td style="padding:8px 32px 24px; text-align:center;">
          <div style="font-size:32px; margin-bottom:8px;">✅</div>
          <p style="color:#1F3A34; font-size:16px; line-height:1.6; margin:0 0 6px; font-weight:600;">${T.title(escapeHtml(customer.name))}</p>
          <p style="color:#4A6259; font-size:14px; line-height:1.6; margin:0 0 12px;">${T.msg(amount)}</p>
          <p style="color:#4A6259; font-size:12px; line-height:1.6; margin:0;">${T.footer}</p>
        </td></tr>
        <tr><td style="padding:24px 32px 28px;">
          <p style="color:#9AA8A2; font-size:11px; margin:0; text-align:center;">${T.sentBy(escapeHtml(bizName))}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const subject = `[${bizName}] ${T.subject}`;

    try {
      await sendEmail(env, { to: customer.contact_email, replyTo: profile.contact_email || undefined, subject, html });
      await logEmailAttempt(env, { ownerId: user.id, recipient: customer.contact_email, subject, status: "sent" });
    } catch (sendErr) {
      await logEmailAttempt(env, { ownerId: user.id, recipient: customer.contact_email, subject, status: "failed", errorMessage: sendErr.message });
      return json({ error: sendErr.message }, 502);
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: `Ralat pelayan: ${err.message}` }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
