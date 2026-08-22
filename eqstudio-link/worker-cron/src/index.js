// eqstudio.link — daily reminder Worker
// Triggered by Cloudflare Cron Trigger (see wrangler.toml).
// Required secrets (set via `wrangler secret put <NAME>`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL
//   MANUAL_TRIGGER_KEY, PUBLIC_SITE_URL
//   BILLPLZ_API_KEY, BILLPLZ_COLLECTION_ID

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Shared visual shell used by every outgoing email type (reminder, billing
// reminder, digest, receipt) so they all feel like the same product, not four
// different templates. Callers supply the body rows (as <tr> HTML) and a
// footer line; the branded top bar + logo/name header + card frame stay fixed.
function emailShell({ brandColor, logoBlock, bodyHtml, footerText }) {
  return `
<!doctype html>
<html>
<body style="margin:0; padding:0; background:#F1EADA; font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EADA; padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px; background:#FBF7EF; border-radius:10px; overflow:hidden; border:1px solid #E8DFCB;" cellpadding="0" cellspacing="0">
        <tr><td style="height:5px; background:${brandColor}; line-height:5px; font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:28px 32px 8px;">${logoBlock}</td></tr>
        ${bodyHtml}
        <tr><td style="padding:24px 32px 28px;">
          <p style="color:#9AA8A2; font-size:11px; margin:0; text-align:center;">${footerText}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildLogoBlock(bizName, logoUrl) {
  return logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(bizName)}" style="max-height:48px; max-width:200px; display:block; margin:0 auto 12px;" />`
    : `<div style="font-family:Georgia,serif; font-size:20px; font-weight:600; color:#1F3A34; text-align:center; margin-bottom:12px;">${escapeHtml(bizName)}</div>`;
}

// A "+ Tambah ke Kalendar" link — no attachment/MIME complexity, works in one
// click for the vast majority of customers (Google Calendar; also opens fine
// via browser for most other calendar apps that support the same URL scheme).
function buildGoogleCalendarLink({ title, description, dueDateISO }) {
  const start = dueDateISO.replace(/-/g, "");
  const endDate = new Date(dueDateISO + "T00:00:00Z");
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const end = endDate.toISOString().slice(0, 10).replace(/-/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${start}/${end}`,
    details: description,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Sends via Resend. Throws on failure — callers catch + log via logEmailAttempt().

// ── Multi-language customer-facing strings (Fasa 24) ──
// Note: zh/ta translations are AI-generated from general training knowledge —
// recommend a native-speaker review before relying on them for tone/formality.
const I18N = {
  ms: {
    greeting: (n) => `Salam ${n},`,
    reminderEarly: (d) => `Sekadar peringatan mesra — bayaran anda due dalam <strong>${d} hari</strong>.`,
    reminderToday: `Bayaran anda due <strong>HARI INI</strong>.`,
    reminderOverdue: `Bayaran anda telah <strong>melepasi tarikh due</strong>.`,
    subtextEarly: "Tiada tindakan segera diperlukan, cuma nak pastikan anda tak terlepas pandang.",
    subtextToday: "Boleh selesaikan bayaran sekarang menggunakan butang di bawah.",
    subtextOverdue: "Sila selesaikan secepat mungkin untuk elak sebarang gangguan pada perkhidmatan.",
    amount: "Jumlah", due: "Tarikh Due",
    payBtn: (a) => `Bayar Sekarang — RM ${a}`,
    waBtn: "Ada Soalan? WhatsApp Kami",
    calBtn: "📅 Tambah ke Kalendar",
    bankLabel: "Atau bank transfer terus",
    qrLabel: "🇲🇾 Scan QR DuitNow",
    qrNote: "Serasi semua bank & e-wallet (TnG, Boost, GrabPay, dll)",
    viewStatus: "Lihat status bayaran",
    stages: ["Peringatan Awal", "Hari-Ini", "Tertunggak"],
    tagLabel: "PERINGATAN BAYARAN",
    footer: (biz) => `Dihantar automatik melalui eqstudio.link untuk ${biz}`,
    subjectEarly: (d) => `Peringatan bayaran — due dalam ${d} hari`,
    subjectToday: "Peringatan bayaran — due HARI INI",
    subjectOverdue: "Bayaran telah tertunggak",
    apptSubject: (biz) => `Peringatan: Appointment anda esok dengan ${biz}`,
    apptGreeting: (n) => `Salam ${n},`,
    apptBody: (biz, time) => `Sekadar peringatan mesra — anda ada appointment dengan <strong>${biz}</strong> esok, pukul <strong>${time}</strong>.`,
    apptFooter: "Kami tak sabar nak jumpa anda!",
  },
  en: {
    greeting: (n) => `Hi ${n},`,
    reminderEarly: (d) => `Just a friendly reminder — your payment is due in <strong>${d} days</strong>.`,
    reminderToday: `Your payment is due <strong>TODAY</strong>.`,
    reminderOverdue: `Your payment is <strong>past the due date</strong>.`,
    subtextEarly: "No urgent action needed, just don't want you to miss it.",
    subtextToday: "You can settle it now using the button below.",
    subtextOverdue: "Please settle as soon as possible to avoid any service disruption.",
    amount: "Amount", due: "Due Date",
    payBtn: (a) => `Pay Now — RM ${a}`,
    waBtn: "Questions? WhatsApp Us",
    calBtn: "📅 Add to Calendar",
    bankLabel: "Or bank transfer directly",
    qrLabel: "🇲🇾 Scan DuitNow QR",
    qrNote: "Works with all banks & e-wallets (TnG, Boost, GrabPay, etc.)",
    viewStatus: "View payment status",
    stages: ["Early Reminder", "Due Today", "Overdue"],
    tagLabel: "PAYMENT REMINDER",
    footer: (biz) => `Sent automatically via eqstudio.link for ${biz}`,
    subjectEarly: (d) => `Payment reminder — due in ${d} days`,
    subjectToday: "Payment reminder — due TODAY",
    subjectOverdue: "Payment is overdue",
    apptSubject: (biz) => `Reminder: Your appointment tomorrow with ${biz}`,
    apptGreeting: (n) => `Hi ${n},`,
    apptBody: (biz, time) => `Just a friendly reminder — you have an appointment with <strong>${biz}</strong> tomorrow at <strong>${time}</strong>.`,
    apptFooter: "We look forward to seeing you!",
  },
  zh: {
    greeting: (n) => `${n}，您好，`,
    reminderEarly: (d) => `友情提醒 — 您的付款将在 <strong>${d} 天后</strong>到期。`,
    reminderToday: `您的付款<strong>今天到期</strong>。`,
    reminderOverdue: `您的付款<strong>已逾期</strong>。`,
    subtextEarly: "无需立即处理，只是提醒您别错过。",
    subtextToday: "您可以点击下方按钮立即完成付款。",
    subtextOverdue: "请尽快完成付款，以免影响服务。",
    amount: "金额", due: "到期日",
    payBtn: (a) => `立即付款 — RM ${a}`,
    waBtn: "有疑问？WhatsApp 联系我们",
    calBtn: "📅 添加到日历",
    bankLabel: "或直接银行转账",
    qrLabel: "🇲🇾 扫描 DuitNow QR",
    qrNote: "适用于所有银行和电子钱包（TnG、Boost、GrabPay 等）",
    viewStatus: "查看付款状态",
    stages: ["提前提醒", "今日到期", "逾期"],
    tagLabel: "付款提醒",
    footer: (biz) => `由 eqstudio.link 为 ${biz} 自动发送`,
    subjectEarly: (d) => `付款提醒 — ${d} 天后到期`,
    subjectToday: "付款提醒 — 今天到期",
    subjectOverdue: "付款已逾期",
    apptSubject: (biz) => `提醒：您明天与 ${biz} 的预约`,
    apptGreeting: (n) => `${n}，您好，`,
    apptBody: (biz, time) => `友情提醒 — 您明天 <strong>${time}</strong> 与 <strong>${biz}</strong> 有预约。`,
    apptFooter: "我们期待与您见面！",
  },
  ta: {
    greeting: (n) => `வணக்கம் ${n},`,
    reminderEarly: (d) => `நட்பான நினைவூட்டல் — உங்கள் கட்டணம் <strong>${d} நாட்களில்</strong> செலுத்த வேண்டும்.`,
    reminderToday: `உங்கள் கட்டணம் <strong>இன்று</strong> செலுத்த வேண்டும்.`,
    reminderOverdue: `உங்கள் கட்டணம் <strong>தவணை தேதியைத் தாண்டியுள்ளது</strong>.`,
    subtextEarly: "உடனடி நடவடிக்கை தேவையில்லை, தவறவிடக் கூடாது என்பதற்காக மட்டும்.",
    subtextToday: "கீழே உள்ள பொத்தானைப் பயன்படுத்தி இப்போது செலுத்தலாம்.",
    subtextOverdue: "சேவை தடங்கலைத் தவிர்க்க விரைவில் செலுத்தவும்.",
    amount: "தொகை", due: "தவணை தேதி",
    payBtn: (a) => `இப்போது செலுத்துங்கள் — RM ${a}`,
    waBtn: "கேள்விகளா? WhatsApp மூலம் தொடர்பு கொள்ளுங்கள்",
    calBtn: "📅 காலெண்டரில் சேர்க்கவும்",
    bankLabel: "அல்லது நேரடி வங்கி பரிமாற்றம்",
    qrLabel: "🇲🇾 DuitNow QR ஸ்கேன் செய்யுங்கள்",
    qrNote: "அனைத்து வங்கிகள் & இ-வாலட்களுடன் இணக்கமானது (TnG, Boost, GrabPay, முதலியன)",
    viewStatus: "கட்டண நிலையைப் பார்க்கவும்",
    stages: ["முன் நினைவூட்டல்", "இன்று தவணை", "தாமதம்"],
    tagLabel: "கட்டண நினைவூட்டல்",
    footer: (biz) => `${biz} க்காக eqstudio.link மூலம் தானாக அனுப்பப்பட்டது`,
    subjectEarly: (d) => `கட்டண நினைவூட்டல் — ${d} நாட்களில் தவணை`,
    subjectToday: "கட்டண நினைவூட்டல் — இன்று தவணை",
    subjectOverdue: "கட்டணம் தாமதமானது",
    apptSubject: (biz) => `நினைவூட்டல்: நாளை ${biz} உடன் உங்கள் சந்திப்பு`,
    apptGreeting: (n) => `வணக்கம் ${n},`,
    apptBody: (biz, time) => `நட்பான நினைவூட்டல் — நாளை <strong>${time}</strong> மணிக்கு <strong>${biz}</strong> உடன் உங்களுக்கு சந்திப்பு உள்ளது.`,
    apptFooter: "உங்களை சந்திக்க காத்திருக்கிறோம்!",
  },
};
function t(lang) { return I18N[lang] || I18N.ms; }

async function sendEmail(env, { to, replyTo, subject, html, attachment }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to,
      reply_to: replyTo || undefined,
      subject,
      html,
      attachments: attachment ? [{ filename: attachment.filename, content: attachment.contentBase64 }] : undefined,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend send failed (${res.status}): ${detail.slice(0, 400)}`);
  }
}

// Records every send attempt (success or failure) so failures are visible in the
// admin dashboard instead of only showing up in `wrangler tail`.
async function logEmailAttempt(env, { ownerId, recipient, subject, emailType, status, errorMessage }) {
  try {
    await sb(env, "/email_send_log", {
      method: "POST",
      prefer: "return=minimal",
      body: JSON.stringify({
        owner_id: ownerId || null,
        recipient,
        subject: subject?.slice(0, 200) || null,
        email_type: emailType,
        status,
        error_message: errorMessage ? String(errorMessage).slice(0, 1000) : null,
      }),
    });
  } catch (logErr) {
    console.error(`Failed to write email_send_log: ${logErr.message}`); // never let logging itself break the sweep
  }
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

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

async function ensureCustomerBill(env, customer) {
  // Reuse an existing pending invoice bill for this customer if one exists
  const existing = await sb(env, `/bills?customer_id=eq.${customer.id}&bill_type=eq.customer_invoice&status=eq.pending&select=gateway_bill_url&limit=1`);
  if (existing.length > 0) return existing[0].gateway_bill_url;

  const site = env.PUBLIC_SITE_URL || "https://eqstudio.link";
  const form = new URLSearchParams({
    collection_id: env.BILLPLZ_COLLECTION_ID,
    email: customer.contact_email,
    name: customer.name,
    amount: String(Math.round(Number(customer.amount) * 100)),
    description: `Bayaran: ${customer.name}${customer.notes ? " — " + customer.notes : ""}`.slice(0, 200),
    callback_url: `${site}/api/billplz-webhook`,
    redirect_url: `${site}/paid.html`,
  });
  const res = await fetch("https://www.billplz.com/api/v3/bills", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${env.BILLPLZ_API_KEY}:`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`Billplz create customer bill failed: ${res.status} ${await res.text()}`);
  const bill = await res.json();

  await sb(env, "/bills", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify({
      owner_id: customer.owner_id,
      customer_id: customer.id,
      gateway_bill_id: bill.id,
      payment_gateway: "billplz",
      amount: customer.amount,
      status: "pending",
      gateway_bill_url: bill.url,
      bill_type: "customer_invoice",
    }),
  });

  return bill.url;
}

function hexToRgb01(hex) {
  const clean = (hex || "#C97A2B").replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return rgb(r || 0, g || 0, b || 0);
}

async function generateInvoicePdfBase64(customer, profile) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 560]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const brand = hexToRgb01(profile?.brand_color);
  const ink = rgb(0.12, 0.22, 0.2);
  const inkSoft = rgb(0.29, 0.38, 0.35);

  let y = 500;
  page.drawRectangle({ x: 0, y: 552, width: 420, height: 8, color: brand });

  const bizName = profile?.business_name?.trim() || "eqstudio.link";
  page.drawText(bizName, { x: 40, y, size: 18, font: fontBold, color: ink });
  y -= 34;
  page.drawText("INVOIS", { x: 40, y, size: 11, font, color: inkSoft });
  if (profile?.ssm_number) {
    page.drawText(`No. Pendaftaran: ${profile.ssm_number}`, { x: 200, y, size: 9, font, color: inkSoft });
  }
  y -= 30;

  page.drawLine({ start: { x: 40, y }, end: { x: 380, y }, thickness: 0.5, color: rgb(0.85, 0.82, 0.75) });
  y -= 24;

  const rows = [
    ["Nama Pelanggan", customer.name],
    ["Jumlah", `RM ${Number(customer.amount).toFixed(2)}`],
    ["Tarikh Due", customer.due_date],
  ];
  if (customer.notes) rows.push(["Catatan", customer.notes]);

  for (const [label, value] of rows) {
    page.drawText(label, { x: 40, y, size: 10, font, color: inkSoft });
    page.drawText(String(value), { x: 200, y, size: 10, font: fontBold, color: ink });
    y -= 22;
  }

  y -= 12;
  page.drawLine({ start: { x: 40, y }, end: { x: 380, y }, thickness: 0.5, color: rgb(0.85, 0.82, 0.75) });
  y -= 24;

  const contactBits = [profile?.contact_phone, profile?.contact_email, profile?.business_address].filter(Boolean);
  if (contactBits.length) {
    page.drawText("Hubungi kami:", { x: 40, y, size: 9, font, color: inkSoft });
    y -= 16;
    for (const bit of contactBits) {
      page.drawText(bit, { x: 40, y, size: 9, font, color: ink });
      y -= 14;
    }
  }

  page.drawText("Dijana automatik melalui eqstudio.link", { x: 40, y: 30, size: 8, font, color: inkSoft });

  const bytes = await doc.save();
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function sendReminderEmail(env, customer, daysOffset, profile, payUrl) {
  const bizName = profile?.business_name?.trim() || "eqstudio.link";
  const brandColor = profile?.brand_color || "#C97A2B";
  const amount = Number(customer.amount).toFixed(2);
  const T = t(customer.preferred_language);

  let subject, headline, subtext, urgencyColor;
  if (daysOffset > 0) {
    subject = `[${bizName}] ${T.subjectEarly(daysOffset)} — RM${amount}`;
    headline = T.reminderEarly(daysOffset);
    subtext = T.subtextEarly;
    urgencyColor = "#E8834E";
  } else if (daysOffset === 0) {
    subject = `[${bizName}] ${T.subjectToday} — RM${amount}`;
    headline = T.reminderToday;
    subtext = T.subtextToday;
    urgencyColor = "#E8834E";
  } else {
    subject = `[${bizName}] ${T.subjectOverdue} — RM${amount}`;
    headline = T.reminderOverdue;
    subtext = T.subtextOverdue;
    urgencyColor = "#E85D5D";
  }

  const contactLines = [];
  if (profile?.contact_phone) contactLines.push(`📞 ${escapeHtml(profile.contact_phone)}`);
  if (profile?.contact_email) contactLines.push(`✉️ ${escapeHtml(profile.contact_email)}`);
  if (profile?.business_address) contactLines.push(`📍 ${escapeHtml(profile.business_address)}`);

  const stageIndex = daysOffset > 0 ? 0 : daysOffset === 0 ? 1 : 2;
  const timelineHtml = T.stages.map((label, i) => {
    const isActive = i === stageIndex;
    const isPast = i < stageIndex;
    const dotColor = isActive ? urgencyColor : isPast ? "#B8C4BE" : "#E8DFCB";
    const textColor = isActive ? "#1F3A34" : "#9AA8A2";
    const dot = `<div style="width:10px; height:10px; border-radius:50%; background:${dotColor}; margin:0 auto 6px; ${isActive ? `box-shadow:0 0 0 3px ${urgencyColor}22;` : ""}"></div>`;
    const line = i < T.stages.length - 1
      ? `<div style="position:absolute; top:5px; left:calc(50% + 10px); width:calc(100% - 10px); height:2px; background:${isPast || isActive ? "#B8C4BE" : "#E8DFCB"};"></div>`
      : "";
    return `<td style="position:relative; text-align:center; width:33%; padding-top:2px;">${line}${dot}<span style="font-size:10px; font-family:Helvetica,Arial,sans-serif; color:${textColor}; font-weight:${isActive ? "700" : "400"};">${label}</span></td>`;
  }).join("");

  const logoBlock = buildLogoBlock(bizName, profile?.logo_url);

  let ownerWaLink = null;
  if (profile?.contact_phone) {
    const digits = profile.contact_phone.replace(/[^0-9]/g, "");
    const withCountryCode = digits.startsWith("0") ? "60" + digits.slice(1) : digits;
    const msg = encodeURIComponent(`Salam, saya nak tanya pasal invois RM${amount} (${customer.name}).`);
    ownerWaLink = `https://wa.me/${withCountryCode}?text=${msg}`;
  }

  const calendarLink = buildGoogleCalendarLink({
    title: `Bayaran ${bizName}: RM${amount}`,
    description: `Bayaran RM${amount} kepada ${bizName}${customer.notes ? " — " + customer.notes : ""}.`,
    dueDateISO: customer.due_date,
  });

  const bodyHtml = `
        <tr><td style="padding:8px 32px 0;">
          <p style="color:#1F3A34; font-size:15px; line-height:1.6; margin:0 0 4px;">${T.greeting(escapeHtml(customer.name))}</p>
          <p style="color:#1F3A34; font-size:15px; line-height:1.6; margin:0 0 4px;">${headline}</p>
          <p style="color:#4A6259; font-size:13px; line-height:1.6; margin:0 0 20px;">${subtext}</p>
        </td></tr>
        <tr><td style="padding:0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff; border:1px solid #E8DFCB; border-left:3px solid ${brandColor}; border-radius:8px;">
            <tr>
              <td style="padding:16px 20px; border-bottom:1px dashed #E8DFCB; font-family:monospace; font-size:14px; color:#4A6259;">${T.amount}</td>
              <td style="padding:16px 20px; border-bottom:1px dashed #E8DFCB; font-family:monospace; font-size:14px; color:#1F3A34; text-align:right; font-weight:600;">RM ${amount}</td>
            </tr>
            <tr>
              <td style="padding:16px 20px; font-family:monospace; font-size:14px; color:#4A6259;">${T.due}</td>
              <td style="padding:16px 20px; font-family:monospace; font-size:14px; color:#1F3A34; text-align:right; font-weight:600;">${customer.due_date}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${timelineHtml}</tr></table>
        </td></tr>
        ${customer.notes ? `
        <tr><td style="padding:14px 32px 0;">
          <p style="color:#4A6259; font-size:13px; line-height:1.6; margin:0;"><em>${escapeHtml(customer.notes)}</em></p>
        </td></tr>` : ""}
        <tr><td style="padding:20px 32px 4px;">
          <span style="display:inline-block; border:2px solid ${urgencyColor}; color:${urgencyColor}; border-radius:6px; padding:4px 12px; font-size:12px; font-weight:700; letter-spacing:0.05em;">${T.tagLabel}</span>
        </td></tr>
        ${payUrl ? `
        <tr><td style="padding:16px 32px 4px;">
          <a href="${payUrl}" style="display:block; text-align:center; background:${brandColor}; color:#ffffff; text-decoration:none; font-weight:700; font-size:14px; padding:13px 20px; border-radius:8px; font-family:Helvetica,Arial,sans-serif;">${T.payBtn(amount)}</a>
        </td></tr>` : ""}
        <tr><td style="padding:8px 32px 0;">
          <a href="${calendarLink}" style="display:block; text-align:center; background:#ffffff; color:#4A6259; text-decoration:none; font-weight:600; font-size:12px; padding:9px 20px; border-radius:8px; border:1px dashed #C9BFA9; font-family:Helvetica,Arial,sans-serif;">${T.calBtn}</a>
        </td></tr>
        ${ownerWaLink ? `
        <tr><td style="padding:8px 32px 0;">
          <a href="${ownerWaLink}" style="display:block; text-align:center; background:#ffffff; color:${brandColor}; text-decoration:none; font-weight:700; font-size:13px; padding:11px 20px; border-radius:8px; border:1.5px solid ${brandColor}; font-family:Helvetica,Arial,sans-serif;">${T.waBtn}</a>
        </td></tr>` : ""}
        ${(profile?.bank_name && profile?.bank_account_number) || profile?.qr_code_url ? `
        <tr><td style="padding:20px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF7EF; border:1px dashed #E8DFCB; border-radius:8px;">
            <tr><td style="padding:14px 18px; text-align:center;">
              <p style="color:#4A6259; font-size:11px; margin:0 0 8px; text-transform:uppercase; letter-spacing:0.05em; text-align:left;">${T.bankLabel}</p>
              ${profile?.bank_name && profile?.bank_account_number ? `
              <p style="color:#1F3A34; font-size:13px; line-height:1.7; margin:0; text-align:left;">
                ${escapeHtml(profile.bank_name)}${profile.bank_account_holder ? " — " + escapeHtml(profile.bank_account_holder) : ""}<br/>
                <strong style="font-family:monospace; font-size:14px;">${escapeHtml(profile.bank_account_number)}</strong>
              </p>` : ""}
              ${profile?.qr_code_url ? `
              <p style="color:#4A6259; font-size:10px; margin:${profile.bank_name ? "14px" : "0"} 0 6px; text-transform:uppercase; letter-spacing:0.05em;">${T.qrLabel}</p>
              <img src="${escapeHtml(profile.qr_code_url)}" alt="QR DuitNow" style="max-width:140px; display:block; margin:0 auto;" />
              <p style="color:#9AA8A2; font-size:10px; margin:6px 0 0;">${T.qrNote}</p>` : ""}
            </td></tr>
          </table>
        </td></tr>` : ""}
        ${contactLines.length ? `
        <tr><td style="padding:24px 32px 4px; border-top:1px solid #E8DFCB; margin-top:20px;">
          <p style="color:#4A6259; font-size:12px; margin:16px 0 6px; text-transform:uppercase; letter-spacing:0.05em;">${T.waBtn}</p>
          <p style="color:#1F3A34; font-size:13px; line-height:1.9; margin:0;">${contactLines.join("<br/>")}</p>
        </td></tr>` : ""}
        <tr><td style="padding:8px 32px 0;">
          <a href="${env.PUBLIC_SITE_URL || "https://eqstudio.link"}/portal.html?token=${customer.portal_token}" style="display:block; text-align:center; color:#9AA8A2; font-size:11px; text-decoration:underline;">${T.viewStatus}</a>
        </td></tr>`;

  const html = emailShell({
    brandColor,
    logoBlock,
    bodyHtml,
    footerText: T.footer(escapeHtml(bizName)),
  });

  const pdfBase64 = await generateInvoicePdfBase64(customer, profile);

  try {
    await sendEmail(env, {
      to: customer.contact_email,
      replyTo: profile?.contact_email || undefined,
      subject,
      html,
      attachment: { filename: `invois-${customer.name.replace(/[^a-z0-9]/gi, "-")}.pdf`, contentBase64: pdfBase64 },
    });
    await logEmailAttempt(env, { ownerId: customer.owner_id, recipient: customer.contact_email, subject, emailType: "reminder", status: "sent" });
  } catch (err) {
    await logEmailAttempt(env, { ownerId: customer.owner_id, recipient: customer.contact_email, subject, emailType: "reminder", status: "failed", errorMessage: err.message });
    throw new Error(`Resend failed for customer ${customer.id}: ${err.message}`);
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function runReminderSweep(env) {
  const today = todayISO();

  // 1. Fetch every owner's reminder schedule and business profile (for email branding)
  //    — these are bulk O(1) requests regardless of customer count.
  const settings = await sb(env, "/reminder_settings?select=owner_id,days_before");
  const scheduleByOwner = new Map(settings.map(s => [s.owner_id, s.days_before]));

  const profiles = await sb(env, "/profiles?select=id,business_name,contact_phone,contact_email,business_address,logo_url,brand_color,bank_name,bank_account_number,bank_account_holder,qr_code_url,ssm_number");
  const profileByOwner = new Map(profiles.map(p => [p.id, p]));

  const customers = await sb(env, "/customers?select=*&status=neq.dah_bayar");

  // 2. Work out which customers match today's schedule
  const candidates = [];
  for (const c of customers) {
    const schedule = scheduleByOwner.get(c.owner_id) || [3, 1, 0];
    const offset = daysBetween(c.due_date, today);
    if (schedule.includes(offset)) candidates.push({ customer: c, offset });
  }

  if (candidates.length === 0) {
    console.log("Reminder sweep: no candidates today");
    return { matched: 0, queued: 0 };
  }

  // 3. Bulk-check which (customer, offset) pairs already have a reminders_log entry.
  //    Chunked "in.()" filter — O(candidates/100) requests instead of one per customer.
  //    This matters once customer counts reach the thousands; a per-customer check here
  //    would itself blow past Workers' per-invocation subrequest limit before we even
  //    get to sending anything.
  const alreadySent = new Set();
  for (const idChunk of chunk(candidates.map(x => x.customer.id), 100)) {
    const logs = await sb(env, `/reminders_log?customer_id=in.(${idChunk.join(",")})&select=customer_id,days_offset`);
    for (const l of logs) alreadySent.add(`${l.customer_id}|${l.days_offset}`);
  }

  const toSend = candidates.filter(x => !alreadySent.has(`${x.customer.id}|${x.offset}`));

  // 4. Process directly (no queue — Queues requires Workers Paid plan, staying on
  //    Free for now while volume is small). Fine at small-to-moderate scale; revisit
  //    a queue-based fan-out if daily volume grows into the hundreds (Workers caps
  //    subrequests per invocation: 50 on Free, 1000 on Paid).
  let sent = 0, failed = 0;
  for (const x of toSend) {
    try {
      await processReminderMessage(env, { customer: x.customer, offset: x.offset, profile: profileByOwner.get(x.customer.owner_id) || null });
      sent++;
    } catch (err) {
      console.error(`Reminder failed for customer ${x.customer.id}: ${err.message}`);
      failed++;
    }
  }

  console.log(`Reminder sweep done: matched=${candidates.length} alreadySent=${candidates.length - toSend.length} sent=${sent} failed=${failed}`);
  return { matched: candidates.length, sent, failed };
}

async function processReminderMessage(env, msg) {
  const { customer: c, offset, profile } = msg;

  let payUrl = null;
  try {
    payUrl = await ensureCustomerBill(env, c);
  } catch (billErr) {
    console.error(`Bill creation failed for ${c.id}: ${billErr.message}`); // still send the reminder even if the payment gateway hiccups
  }

  await sendReminderEmail(env, c, offset, profile, payUrl);

  await sb(env, "/reminders_log", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify({ customer_id: c.id, owner_id: c.owner_id, days_offset: offset }),
  });

  if (c.status === "belum_bayar") {
    await sb(env, `/customers?id=eq.${c.id}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({ status: "reminder_dihantar" }),
    });
  }
}

async function runSingleCustomer(env, customerId) {
  const customers = await sb(env, `/customers?id=eq.${customerId}&select=*`);
  const c = customers[0];
  if (!c) return { sent: false, reason: "not_found" };
  if (c.status === "dah_bayar") return { sent: false, reason: "already_paid" };

  const today = todayISO();
  const offset = daysBetween(c.due_date, today);

  const settings = await sb(env, `/reminder_settings?owner_id=eq.${c.owner_id}&select=days_before`);
  const schedule = settings[0]?.days_before || [3, 1, 0];
  if (!schedule.includes(offset)) return { sent: false, reason: "not_in_schedule", offset };

  const existing = await sb(env, `/reminders_log?customer_id=eq.${c.id}&days_offset=eq.${offset}&select=id`);
  if (existing.length > 0) return { sent: false, reason: "already_sent", offset };

  const profiles = await sb(env, `/profiles?id=eq.${c.owner_id}&select=business_name,contact_phone,contact_email,business_address,logo_url,brand_color,bank_name,bank_account_number,bank_account_holder,qr_code_url`);
  const profile = profiles[0] || null;

  try {
    await processReminderMessage(env, { customer: c, offset, profile });
    return { sent: true, offset };
  } catch (err) {
    console.error(`Instant reminder failed for customer ${c.id}: ${err.message}`);
    return { sent: false, reason: "error", error: err.message };
  }
}

async function getUserEmail(env, ownerId) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${ownerId}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email || null;
}

const PLAN_PRICING = {
  monthly: { amountCents: "1900", amountRM: 19.0, label: "Langganan bulanan eqstudio.link", days: 30 },
  yearly: { amountCents: "19000", amountRM: 190.0, label: "Langganan tahunan eqstudio.link (2 bulan percuma)", days: 365 },
};

async function createRenewalBill(env, ownerId, email, plan) {
  const pricing = PLAN_PRICING[plan] || PLAN_PRICING.monthly;
  const site = env.PUBLIC_SITE_URL || "https://eqstudio.link";
  const form = new URLSearchParams({
    collection_id: env.BILLPLZ_COLLECTION_ID,
    email,
    name: email,
    amount: pricing.amountCents,
    description: pricing.label,
    callback_url: `${site}/api/billplz-webhook`,
    redirect_url: `${site}/billing.html?paid=1`,
  });
  const res = await fetch("https://www.billplz.com/api/v3/bills", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${env.BILLPLZ_API_KEY}:`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  if (!res.ok) throw new Error(`Billplz create bill failed: ${res.status} ${await res.text()}`);
  const bill = await res.json();

  await sb(env, "/bills", {
    method: "POST",
    prefer: "return=minimal",
    body: JSON.stringify({ owner_id: ownerId, gateway_bill_id: bill.id, payment_gateway: "billplz", amount: pricing.amountRM, status: "pending", gateway_bill_url: bill.url }),
  });

  return { url: bill.url };
}

async function sendBillingReminderEmail(env, ownerId, email, billUrl, daysLeft, plan, profile) {
  const pricing = PLAN_PRICING[plan] || PLAN_PRICING.monthly;
  const bizName = profile?.business_name?.trim() || "eqstudio.link";
  const brandColor = profile?.brand_color || "#E8834E";
  const subject = daysLeft > 0
    ? `Langganan eqstudio.link tamat dalam ${daysLeft} hari — sila bayar`
    : `Langganan eqstudio.link telah tamat — sila bayar untuk sambung akses`;

  const bodyHtml = `
        <tr><td style="padding:8px 32px 24px; text-align:center;">
          <p style="color:#1F3A34; font-size:15px; line-height:1.6; margin:0 0 12px;">
            ${daysLeft > 0 ? `Langganan eqstudio.link anda akan tamat dalam <strong>${daysLeft} hari</strong>.` : "Langganan eqstudio.link anda telah <strong>tamat</strong>."}
          </p>
          <p style="color:#4A6259; font-size:13px; line-height:1.6; margin:0 0 20px;">
            Sila bayar RM${pricing.amountRM.toFixed(2)} (pelan ${plan === "yearly" ? "tahunan" : "bulanan"}) untuk sambung akses ${pricing.days} hari lagi — dashboard, reminder automatik, dan semua data pelanggan anda kekal tersedia.
          </p>
          <a href="${billUrl}" style="display:inline-block; background:${brandColor}; color:#ffffff; text-decoration:none; font-weight:700; font-size:14px; padding:12px 28px; border-radius:8px; font-family:Helvetica,Arial,sans-serif;">Bayar Sekarang</a>
        </td></tr>`;

  const html = emailShell({
    brandColor,
    logoBlock: buildLogoBlock(bizName, profile?.logo_url),
    bodyHtml,
    footerText: "eqstudio.link — automasi reminder bayaran untuk perniagaan anda",
  });

  try {
    await sendEmail(env, { to: email, subject, html });
    await logEmailAttempt(env, { ownerId, recipient: email, subject, emailType: "billing_reminder", status: "sent" });
  } catch (err) {
    await logEmailAttempt(env, { ownerId, recipient: email, subject, emailType: "billing_reminder", status: "failed", errorMessage: err.message });
    throw new Error(`Resend billing email failed: ${err.message}`);
  }
}

async function runBillingSweep(env) {
  const now = new Date();
  let billed = 0, pastDue = 0, skipped = 0, failed = 0;

  // 1. Mark anyone whose subscription has already lapsed as past_due
  const lapsed = await sb(env, `/profiles?subscription_status=neq.past_due&subscription_end_date=lt.${now.toISOString()}&select=id`);
  for (const p of lapsed) {
    await sb(env, `/profiles?id=eq.${p.id}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({ subscription_status: "past_due" }),
    });
    pastDue++;
  }

  // 2. For subscriptions ending within 3 days, generate a bill + email (once per cycle)
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const upcoming = await sb(
    env,
    `/profiles?subscription_status=neq.past_due&subscription_end_date=lte.${soon.toISOString()}&select=id,subscription_end_date,subscription_plan`
  );

  for (const p of upcoming) {
    const existing = await sb(env, `/bills?owner_id=eq.${p.id}&status=eq.pending&order=created_at.desc&limit=1`);
    if (existing.length > 0) {
      const ageMs = now - new Date(existing[0].created_at);
      if (ageMs < 20 * 24 * 60 * 60 * 1000) { skipped++; continue; } // already has a live bill this cycle
    }

    try {
      const email = await getUserEmail(env, p.id);
      if (!email) { skipped++; continue; }
      const plan = p.subscription_plan || "monthly";
      const bill = await createRenewalBill(env, p.id, email, plan);
      const daysLeft = Math.ceil((new Date(p.subscription_end_date) - now) / (1000 * 60 * 60 * 24));
      const profRes = await sb(env, `/profiles?id=eq.${p.id}&select=business_name,brand_color,logo_url`);
      await sendBillingReminderEmail(env, p.id, email, bill.url, daysLeft, plan, profRes[0]);
      billed++;
    } catch (err) {
      console.error(err.message);
      failed++;
    }
  }

  console.log(`Billing sweep done: billed=${billed} pastDue=${pastDue} skipped=${skipped} failed=${failed}`);
  return { billed, pastDue, skipped, failed };
}

async function runRecurringSweep(env) {
  const done = await sb(env, "/customers?is_recurring=eq.true&status=eq.dah_bayar&next_generated=eq.false&select=*");
  let regenerated = 0;

  for (const c of done) {
    const nextDue = new Date(c.due_date + "T00:00:00Z");
    nextDue.setUTCDate(nextDue.getUTCDate() + (c.recurring_days || 30));

    await sb(env, "/customers", {
      method: "POST",
      prefer: "return=minimal",
      body: JSON.stringify({
        owner_id: c.owner_id,
        name: c.name,
        contact_email: c.contact_email,
        contact_phone: c.contact_phone,
        amount: c.amount,
        due_date: nextDue.toISOString().slice(0, 10),
        notes: c.notes,
        is_recurring: true,
        recurring_days: c.recurring_days,
        status: "belum_bayar",
      }),
    });

    await sb(env, `/customers?id=eq.${c.id}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({ next_generated: true }),
    });
    regenerated++;
  }

  console.log(`Recurring sweep done: regenerated=${regenerated}`);
  return { regenerated };
}

async function sendDigestEmail(env, ownerId, ownerEmail, stats, profile) {
  const subject = "Ringkasan Harian — eqstudio.link";
  const bizName = profile?.business_name?.trim() || "eqstudio.link";
  const brandColor = profile?.brand_color || "#E8834E";
  const site = env.PUBLIC_SITE_URL || "https://eqstudio.link";

  const statCard = (num, label, color) => `
    <td style="width:33%; text-align:center; padding:14px 4px; background:#ffffff; border:1px solid #E8DFCB; border-radius:8px;">
      <div style="font-family:monospace; font-size:22px; font-weight:700; color:${color};">${num}</div>
      <div style="font-size:10px; color:#4A6259; margin-top:2px;">${label}</div>
    </td>`;

  const bodyHtml = `
        <tr><td style="padding:8px 32px 4px;">
          <p style="color:#1F3A34; font-size:14px; line-height:1.6; margin:0 0 16px; text-align:center;">Ringkasan hari ini untuk perniagaan anda:</p>
        </td></tr>
        <tr><td style="padding:0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="8">
            <tr>
              ${statCard(stats.due, "Due Hari Ini", "#E8834E")}
              ${statCard(stats.reminded, "Reminder Dihantar", "#4CAF7D")}
              ${statCard(stats.overdue, "Tertunggak", "#E85D5D")}
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 32px 4px; text-align:center;">
          <a href="${site}/dashboard.html" style="display:inline-block; background:${brandColor}; color:#ffffff; text-decoration:none; font-weight:700; font-size:13px; padding:11px 24px; border-radius:8px; font-family:Helvetica,Arial,sans-serif;">Semak Dashboard →</a>
        </td></tr>`;

  const html = emailShell({
    brandColor,
    logoBlock: buildLogoBlock(bizName, profile?.logo_url),
    bodyHtml,
    footerText: "Ringkasan automatik ini dihantar sekali sehari — eqstudio.link",
  });

  try {
    await sendEmail(env, { to: ownerEmail, subject, html });
    await logEmailAttempt(env, { ownerId, recipient: ownerEmail, subject, emailType: "digest", status: "sent" });
  } catch (err) {
    await logEmailAttempt(env, { ownerId, recipient: ownerEmail, subject, emailType: "digest", status: "failed", errorMessage: err.message });
    throw new Error(`Resend digest email failed: ${err.message}`);
  }
}

async function runDigestSweep(env) {
  const today = todayISO();
  const customers = await sb(env, "/customers?select=owner_id,due_date,status");
  const byOwner = new Map();

  for (const c of customers) {
    if (c.status === "dah_bayar") continue;
    if (!byOwner.has(c.owner_id)) byOwner.set(c.owner_id, { due: 0, reminded: 0, overdue: 0 });
    const stats = byOwner.get(c.owner_id);
    if (c.due_date === today) stats.due++;
    if (c.status === "reminder_dihantar") stats.reminded++;
    if (c.due_date < today) stats.overdue++;
  }

  let sent = 0, failed = 0;
  for (const [ownerId, stats] of byOwner.entries()) {
    if (stats.due === 0 && stats.reminded === 0 && stats.overdue === 0) continue;
    try {
      const email = await getUserEmail(env, ownerId);
      if (!email) continue;
      const profRes = await sb(env, `/profiles?id=eq.${ownerId}&select=business_name,brand_color,logo_url`);
      await sendDigestEmail(env, ownerId, email, stats, profRes[0]);
      sent++;
    } catch (err) {
      console.error(err.message);
      failed++;
    }
  }

  console.log(`Digest sweep done: sent=${sent} failed=${failed}`);
  return { sent, failed };
}

// ── Appointment-day reminder ("your appointment is tomorrow") — separate from
// the deposit payment reminder, which is about money, not about showing up. ──
async function runAppointmentReminderSweep(env) {
  const now = new Date();
  const myNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const tomorrowStart = new Date(Date.UTC(myNow.getUTCFullYear(), myNow.getUTCMonth(), myNow.getUTCDate() + 1) - 8 * 60 * 60 * 1000);
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000);

  const bookings = await sb(
    env,
    `/bookings?status=eq.confirmed&appointment_reminder_sent_at=is.null&slot_datetime=gte.${tomorrowStart.toISOString()}&slot_datetime=lt.${tomorrowEnd.toISOString()}&select=*`
  );

  let sent = 0, failed = 0;
  for (const b of bookings) {
    try {
      const profiles = await sb(env, `/profiles?id=eq.${b.owner_id}&select=business_name,brand_color,logo_url`);
      const profile = profiles[0] || {};
      const bizName = profile.business_name?.trim() || "eqstudio.link";
      const brandColor = profile.brand_color || "#E8834E";

      let lang = "ms";
      if (b.customer_id) {
        const customers = await sb(env, `/customers?id=eq.${b.customer_id}&select=preferred_language`);
        if (customers[0]?.preferred_language) lang = customers[0].preferred_language;
      }
      const T = t(lang);

      const slotDate = new Date(b.slot_datetime);
      const myParts = new Date(slotDate.getTime() + 8 * 60 * 60 * 1000);
      const timeLabel = `${String(myParts.getUTCHours()).padStart(2, "0")}:${String(myParts.getUTCMinutes()).padStart(2, "0")}`;

      const bodyHtml = `
        <tr><td style="padding:8px 32px 24px; text-align:center;">
          <div style="font-size:32px; margin-bottom:8px;">📅</div>
          <p style="color:#1F3A34; font-size:15px; margin:0 0 6px;">${T.apptGreeting(escapeHtml(b.customer_name))}</p>
          <p style="color:#1F3A34; font-size:15px; line-height:1.6; margin:0 0 12px;">${T.apptBody(escapeHtml(bizName), timeLabel)}</p>
          <p style="color:#4A6259; font-size:12px; margin:0;">${T.apptFooter}</p>
        </td></tr>`;

      const html = emailShell({ brandColor, logoBlock: buildLogoBlock(bizName, profile.logo_url), bodyHtml, footerText: T.footer(escapeHtml(bizName)) });
      const subject = T.apptSubject(bizName);

      await sendEmail(env, { to: b.customer_email, subject, html });
      await logEmailAttempt(env, { ownerId: b.owner_id, recipient: b.customer_email, subject, emailType: "appointment_reminder", status: "sent" });

      await sb(env, `/bookings?id=eq.${b.id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: JSON.stringify({ appointment_reminder_sent_at: new Date().toISOString() }),
      });
      sent++;
    } catch (err) {
      console.error(`Appointment reminder failed for booking ${b.id}: ${err.message}`);
      await logEmailAttempt(env, { ownerId: b.owner_id, recipient: b.customer_email, subject: null, emailType: "appointment_reminder", status: "failed", errorMessage: err.message });
      failed++;
    }
  }

  console.log(`Appointment reminder sweep done: matched=${bookings.length} sent=${sent} failed=${failed}`);
  return { matched: bookings.length, sent, failed };
}

// Wraps a sweep so a thrown error doesn't just vanish into Cloudflare's logs unseen —
// emails the founder so a genuine failure (e.g. Supabase blip) doesn't silently mean
// zero reminders went out that day with nobody noticing.
async function safeRun(sweepName, fn, env) {
  try {
    await fn(env);
  } catch (err) {
    console.error(`${sweepName} sweep failed:`, err);
    try {
      if (env.RESEND_API_KEY && env.FOUNDER_NOTIFY_EMAIL) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: env.RESEND_FROM_EMAIL,
            to: env.FOUNDER_NOTIFY_EMAIL,
            subject: `⚠️ eqstudio.link — Sweep "${sweepName}" Gagal`,
            html: `<p>Sweep <strong>${escapeHtml(sweepName)}</strong> gagal jalan pada ${new Date().toISOString()}.</p><p>Ralat: ${escapeHtml(String(err.message || err).slice(0, 500))}</p><p>Sila semak Cloudflare Worker logs untuk detail penuh.</p>`,
          }),
        });
      }
    } catch { /* alerting itself is best-effort — must never mask the original failure */ }
  }
}

export default {
  async scheduled(event, env, ctx) {
    if (event.cron === "0 1 * * *") {
      // Once-daily full sweep
      ctx.waitUntil(safeRun("Reminders", runReminderSweep, env));
      ctx.waitUntil(safeRun("Billing", runBillingSweep, env));
      ctx.waitUntil(safeRun("Recurring", runRecurringSweep, env));
      ctx.waitUntil(safeRun("Digest", runDigestSweep, env));
      ctx.waitUntil(safeRun("Appointment Reminder", runAppointmentReminderSweep, env));
    } else {
      // Frequent trigger (every 2 hours) — reminders only, see wrangler.toml comment
      ctx.waitUntil(safeRun("Reminders (frequent)", runReminderSweep, env));
    }
  },
  // Manual trigger for testing: visit the Worker URL with ?key=<a secret you set>
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.searchParams.get("key") !== env.MANUAL_TRIGGER_KEY) {
      return new Response("Not found", { status: 404 });
    }
    const mode = url.searchParams.get("run") || "reminders";

    if (mode === "single") {
      const customerId = url.searchParams.get("customer_id");
      if (!customerId) return new Response(JSON.stringify({ error: "customer_id required" }), { status: 400, headers: { "content-type": "application/json" } });
      const result = await runSingleCustomer(env, customerId);
      return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
    }

    const runners = { reminders: runReminderSweep, billing: runBillingSweep, recurring: runRecurringSweep, digest: runDigestSweep, appointment: runAppointmentReminderSweep };
    const result = await (runners[mode] || runReminderSweep)(env);
    return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
  },
};
