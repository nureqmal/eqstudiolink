// eqstudio.link — daily reminder Worker
// Triggered by Cloudflare Cron Trigger (see wrangler.toml).
// Required secrets (set via `wrangler secret put <NAME>`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL

function todayISO() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC — Worker runs on UTC cron)
}

function daysBetween(dueISO, todayStr) {
  const due = new Date(dueISO + "T00:00:00Z");
  const today = new Date(todayStr + "T00:00:00Z");
  return Math.round((due - today) / (1000 * 60 * 60 * 24));
}

async function sb(env, path, options = {}) {
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
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${path} failed: ${res.status} ${body}`);
  }
  return res.status === 204 ? null : res.json();
}

async function sendReminderEmail(env, customer, daysOffset) {
  let subject, headline;
  if (daysOffset > 0) {
    subject = `Peringatan: bayaran RM${Number(customer.amount).toFixed(2)} due dalam ${daysOffset} hari`;
    headline = `Bayaran anda due dalam ${daysOffset} hari (${customer.due_date}).`;
  } else if (daysOffset === 0) {
    subject = `Peringatan: bayaran RM${Number(customer.amount).toFixed(2)} due HARI INI`;
    headline = `Bayaran anda due HARI INI (${customer.due_date}).`;
  } else {
    subject = `Peringatan: bayaran RM${Number(customer.amount).toFixed(2)} telah tertunggak`;
    headline = `Bayaran anda telah melepasi tarikh due (${customer.due_date}).`;
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <p>Salam ${escapeHtml(customer.name)},</p>
      <p>${headline}</p>
      <p><strong>Jumlah:</strong> RM${Number(customer.amount).toFixed(2)}<br/>
         <strong>Tarikh Due:</strong> ${customer.due_date}</p>
      ${customer.notes ? `<p><strong>Catatan:</strong> ${escapeHtml(customer.notes)}</p>` : ""}
      <p>Sila hubungi kami untuk sebarang pertanyaan. Terima kasih!</p>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: customer.contact_email,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend failed for customer ${customer.id}: ${res.status} ${body}`);
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function runReminderSweep(env) {
  const today = todayISO();

  // 1. Fetch every owner's reminder schedule
  const settings = await sb(env, "/reminder_settings?select=owner_id,days_before");
  const scheduleByOwner = new Map(settings.map(s => [s.owner_id, s.days_before]));

  // 2. Fetch all customers not yet paid
  const customers = await sb(env, "/customers?select=*&status=neq.dah_bayar");

  let sent = 0, skipped = 0, failed = 0;

  for (const c of customers) {
    const schedule = scheduleByOwner.get(c.owner_id) || [3, 1, 0];
    const offset = daysBetween(c.due_date, today); // e.g. 3, 1, 0, or negative if overdue

    if (!schedule.includes(offset)) { skipped++; continue; }

    // Avoid double-sending the same offset for the same customer (unique index also enforces this)
    const existing = await sb(env, `/reminders_log?customer_id=eq.${c.id}&days_offset=eq.${offset}&select=id`);
    if (existing.length > 0) { skipped++; continue; }

    try {
      await sendReminderEmail(env, c, offset);
      await sb(env, "/reminders_log", {
        method: "POST",
        body: JSON.stringify({ customer_id: c.id, owner_id: c.owner_id, days_offset: offset }),
      });
      if (c.status === "belum_bayar") {
        await sb(env, `/customers?id=eq.${c.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "reminder_dihantar" }),
          prefer: "return=minimal",
        });
      }
      sent++;
    } catch (err) {
      console.error(err.message);
      failed++;
    }
  }

  console.log(`Reminder sweep done: sent=${sent} skipped=${skipped} failed=${failed}`);
  return { sent, skipped, failed };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runReminderSweep(env));
  },
  // Manual trigger for testing: visit the Worker URL with ?key=<a secret you set>
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.searchParams.get("key") !== env.MANUAL_TRIGGER_KEY) {
      return new Response("Not found", { status: 404 });
    }
    const result = await runReminderSweep(env);
    return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
  },
};
