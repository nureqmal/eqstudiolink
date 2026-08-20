// Cloudflare Pages Function — POST /api/contact-submit (public, landing page)
// Body: { name, email, topic, message }
// Required env vars: RESEND_API_KEY, RESEND_FROM_EMAIL, FOUNDER_NOTIFY_EMAIL

function escapeHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { name, email, topic, message } = await request.json();
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return json({ error: "Nama, emel, dan mesej diperlukan." }, 400);
    }
    if (message.length > 2000) return json({ error: "Mesej terlalu panjang." }, 400);

    if (env.RESEND_API_KEY && env.FOUNDER_NOTIFY_EMAIL) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.RESEND_FROM_EMAIL,
          to: env.FOUNDER_NOTIFY_EMAIL,
          subject: `📩 Contact Form — ${topic || "General"} — ${escapeHtml(name)}`,
          html: `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) — <em>${escapeHtml(topic || "General")}</em>:</p>
                 <p style="background:#f5f0e6;padding:12px;border-radius:8px;">${escapeHtml(message)}</p>`,
          reply_to: email,
        }),
      });
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
