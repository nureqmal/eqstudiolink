// Owner-facing UI language system — separate from the CUSTOMER-facing multi-language
// system already used in book.html/manage-booking.html/portal.html (that one is
// per-customer preferred_language stored in the DB; this one is a pure client-side
// toggle for the OWNER's own UI language, default English, switchable to Malay).
//
// Usage: mark an element with data-i18n="key" (sets textContent), data-i18n-html="key"
// (sets innerHTML, for strings with inline tags), or data-i18n-placeholder="key" (sets
// the placeholder attribute). Call applyLanguage(getCurrentLang()) on page load.

export const UI_STRINGS = {
  en: {
    nav_login: "Log In",
    nav_cta: "Start Free",

    hero_eyebrow: "Booking & Client Manager for Solo Business Owners",
    hero_h1: "Customers book themselves. Deposits and reminders handle themselves too.",
    hero_sub: "Home baker, tutor, photographer, fitness coach — anyone who's lost a lead because a WhatsApp reply came too late. Give customers a link to book you directly. Deposit, invoice, reminder all run automatically once a booking's confirmed.",
    hero_cta_primary: "Start Free",
    hero_cta_secondary: "See Full Details",
    hero_trial_note: "14-day trial, no card needed",

    features_h2: "Everything you need, in one place",
    feat_booking_title: "Online Booking",
    feat_booking_desc: "Customers pick a date and open slot, straight from your own link.",
    feat_deposit_title: "Automatic Deposit & Reminders",
    feat_deposit_desc: "Deposit gets charged right away. Reminders go out on H-3, H-1, and the day itself.",
    feat_selfserve_title: "Customers Handle Their Own Changes",
    feat_selfserve_desc: "They reschedule or cancel themselves, within whatever notice window you set.",
    feat_multilang_title: "Multiple Languages",
    feat_multilang_desc: "Customers pick their own language — emails and the portal follow suit.",
    feat_reports_title: "Reports & Analytics",
    feat_reports_desc: "Income trends, cash-flow forecast, risk scoring, milestones as you hit them.",
    feat_forum_title: "Community Forum",
    feat_forum_desc: "Swap notes, ask questions, get ideas from other owners using eqstudio.link.",

    pricing_h2: "Pricing",
    pricing_lead: "Pick the plan that fits. Go yearly and save 2 months.",
    pricing_starter: "Starter",
    pricing_pro: "Pro",
    pricing_cta: "Start Free",

    cta_band_h2: "Start Free Today",
    cta_band_sub: "14 days. No risk. No card.",
    cta_band_btn: "Start Free",
  },
  ms: {
    nav_login: "Log Masuk",
    nav_cta: "Mula Percuma",

    hero_eyebrow: "Booking & Client Manager untuk Business Owner Solo",
    hero_h1: "Customer book sendiri. Deposit dan reminder pun jalan sendiri.",
    hero_sub: "Home baker, tutor, photographer, fitness coach — sesiapa yang pernah terlepas lead sebab reply WhatsApp lambat sikit. Bagi customer satu link untuk book terus dengan awak. Deposit, invois, reminder semua jalan automatik lepas booking confirm.",
    hero_cta_primary: "Mula Percuma",
    hero_cta_secondary: "Tengok Butiran Lanjut",
    hero_trial_note: "Trial 14 hari, tak perlu kad",

    features_h2: "Semua yang anda perlukan, dalam satu tempat",
    feat_booking_title: "Booking Online",
    feat_booking_desc: "Customer pilih tarikh & slot kosong, terus dari link peribadi anda.",
    feat_deposit_title: "Deposit & Reminder Automatik",
    feat_deposit_desc: "Deposit terus dicaj. Reminder hantar sendiri — H-3, H-1, dan hari-ini.",
    feat_selfserve_title: "Customer Urus Sendiri",
    feat_selfserve_desc: "Reschedule atau cancel sendiri, dalam had notis yang anda set.",
    feat_multilang_title: "Pelbagai Bahasa",
    feat_multilang_desc: "Customer pilih bahasa sendiri — emel dan portal ikut sekali.",
    feat_reports_title: "Laporan & Analytics",
    feat_reports_desc: "Trend income, unjuran cash-flow, risk scoring, milestone bila dicapai.",
    feat_forum_title: "Forum Komuniti",
    feat_forum_desc: "Kongsi cerita, tanya soalan, dapat idea dari owner lain yang guna eqstudio.link.",

    pricing_h2: "Harga",
    pricing_lead: "Pilih pelan yang sesuai. Ambil tahunan, jimat 2 bulan.",
    pricing_starter: "Starter",
    pricing_pro: "Pro",
    pricing_cta: "Mula Percuma",

    cta_band_h2: "Mula Percuma Hari Ini",
    cta_band_sub: "14 hari. Tanpa risiko. Tanpa kad.",
    cta_band_btn: "Mula Percuma",
  },
};

export function getCurrentLang() {
  return localStorage.getItem("eqstudio_ui_lang") || "en";
}

export function applyLanguage(lang) {
  const normalized = UI_STRINGS[lang] ? lang : "en";
  localStorage.setItem("eqstudio_ui_lang", normalized);
  document.documentElement.setAttribute("lang", normalized);
  const dict = UI_STRINGS[normalized];

  document.querySelectorAll("[data-i18n]").forEach(el => {
    if (dict[el.dataset.i18n] != null) el.textContent = dict[el.dataset.i18n];
  });
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    if (dict[el.dataset.i18nHtml] != null) el.innerHTML = dict[el.dataset.i18nHtml];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    if (dict[el.dataset.i18nPlaceholder] != null) el.placeholder = dict[el.dataset.i18nPlaceholder];
  });

  document.querySelectorAll("[data-lang-toggle]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.langToggle === normalized);
  });
}
