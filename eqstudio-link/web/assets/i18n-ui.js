// Owner-facing UI language system, separate from the CUSTOMER-facing multi-language
// system already used in book.html/manage-booking.html/portal.html (that one is
// per-customer preferred_language stored in the DB; this one is a pure client-side
// toggle for the OWNER's own UI language, default English, switchable to Malay).
//
// Style rules for this dictionary (both languages): no em-dashes, ever. Vary sentence
// length and openers, especially across the FAQ, so answers don't all read the same
// shape. Malay uses "anda" (not "awak"), and mixes in English technical terms where
// a Malaysian business owner would naturally say them in English anyway (reschedule,
// invoice, deposit, dashboard) rather than translating everything to formal Malay.
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
    hero_sub: "Home baker, tutor, photographer, fitness coach: anyone who's lost a lead because a WhatsApp reply came too late. Give customers a link to book you directly, and deposit, invoice, and reminder all run automatically once a booking's confirmed.",
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
    feat_multilang_desc: "Customers pick their own language. Emails and the portal follow suit.",
    feat_reports_title: "Reports & Analytics",
    feat_reports_desc: "Income trends, cash-flow forecast, risk scoring, milestones as you hit them.",
    feat_forum_title: "Community Forum",
    feat_forum_desc: "Swap notes, ask questions, get ideas from other owners using eqstudio.link.",

    compare_h2: "The Old Way vs eqstudio.link",
    compare_lead: "Not a replacement for how you run your business. Just the part that's easiest to drop.",
    compare_old_title: "The Old Way (WhatsApp / Notebook)",
    compare_old_1: "A customer asks \"got any slots free?\" and by the time you reply, they've booked elsewhere.",
    compare_old_2: "Scrolling back through old chats to find out who still owes a deposit.",
    compare_old_3: "Forgetting to follow up because you're busy with the next order.",
    compare_old_4: "That awkward feeling of having to keep asking customers to pay.",
    compare_new_title: "With eqstudio.link",
    compare_new_1: "Customers book their own slot from your personal link, any time, day or night.",
    compare_new_2: "Deposit request goes out automatically the moment a booking is confirmed.",
    compare_new_3: "Every booking and payment status lives in one dashboard.",
    compare_new_4: "The system does the chasing. You stay the one who just runs the business.",

    pricing_h2: "Pricing",
    pricing_lead: "Pick the plan that fits. Go yearly and save 2 months.",
    pricing_starter: "Starter",
    pricing_pro: "Pro",
    pricing_cta: "Start Free",

    faq_h2: "Frequently Asked Questions",
    faq_q1: "How does online booking actually work?",
    faq_a1: "You get a personal link (eqstudio.link/book.html?slug=...). Customers open it, pick a date and open slot, fill in their details, and submit. No more WhatsApp back-and-forth just to confirm a date. You can also embed it in your own website, or print a QR code for the counter.",
    faq_q2: "When is the deposit requested, and how do customers pay?",
    faq_a2: "Right after a booking is confirmed, the system emails a deposit request automatically. Customers can pay online directly through a \"Pay Now\" button, or use manual bank transfer plus a DuitNow QR (works with TnG, Boost, GrabPay and the rest) if you've set that up in your business profile.",
    faq_q3: "Can I ask customers extra questions during booking?",
    faq_a3: "Yes. Add \"Additional Questions\" in Booking Settings, things like \"What kind of cake?\" or \"What size?\". They show up in the booking form after the customer picks a slot, and the answers land straight in your dashboard.",
    faq_q4: "Can I set my available hours and buffer time?",
    faq_a4: "You can. Set your operating days and hours in Booking Settings using a weekly grid, just a few clicks. There's also a \"Buffer Time\" option (0 to 30 minutes) if you want automatic breathing room between bookings.",
    faq_q5: "Can customers reschedule or cancel on their own?",
    faq_a5: "Every booking confirmation email comes with a \"Reschedule / Cancel\" button built right in. Customers pick a new slot from your real availability, or cancel with a reason. You get notified by email either way.",
    faq_q6: "Do I get proper invoices?",
    faq_a6: "You do. Every reminder email comes with a PDF invoice attached, and you can download one anytime from the dashboard without waiting for the reminder cycle.",
    faq_q7: "Can customers check their own payment status?",
    faq_a7: "Every email includes a personal link where customers can check whether they've paid, and settle up right there, no account needed.",
    faq_q8: "Can I offer more than one type of service with different pricing?",
    faq_a8: "Add \"Service Types\" (Event Types) in Booking Settings, for example \"Cake Collection, 10 minutes\" versus \"Baking Class, 2 hours, RM100\". Customers choose the type first when booking. Group classes work too. Just set capacity above 1 (a Zumba class, say, where several people book the same slot).",
    faq_q9: "Can I run free bookings, like a RM0 consultation?",
    faq_a9: "Type 0 into the Default Deposit field, or set it per service type. The system won't send a \"please pay\" email for a free booking.",
    faq_q10: "Can I run more than one business on a single account?",
    faq_a10: "That's what the Pro plan is for (RM39/month or RM390/year). You get up to 3 booking links, each with its own calendar, service types, and deposit settings.",
    faq_q11: "Is there reporting or analytics?",
    faq_a11: "The dashboard's Reports page shows income trends, a 6-week cash-flow forecast, and risk scoring, which flags customers who tend to pay late based on their history with you.",
    faq_q12: "Can customers use a different language?",
    faq_a12: "Customers choose their own language when booking: Malay, English, Chinese, or Tamil. Their emails and self-serve portal follow whichever they pick.",
    faq_q13: "How does recurring payment work for repeat customers?",
    faq_a13: "Mark \"Recurring Payment\" when adding a customer and pick an interval (7, 14, 30, or 60 days). The system generates the next cycle automatically once they've paid, so you're not adding it manually every time.",
    faq_q14: "Is my customer data safe?",
    faq_a14: "Every account can only see its own customer data. That's enforced at the database level, not just hidden in the interface. We don't share your data with anyone. See our <a href=\"/privacy-policy.html\">Privacy Policy</a> for the details.",
    faq_q15: "Do I need a credit card for the 14-day trial?",
    faq_a15: "No. Sign up with just an email and try it out before committing to anything.",
    faq_q16: "Can I cancel my subscription anytime?",
    faq_a16: "Yes, there's no lock-in contract. Cancel directly from the dashboard whenever you're ready to stop.",

    dash_stat_upcoming: "Upcoming Bookings",
    dash_stat_outstanding: "Outstanding",
    dash_stat_income_month: "Income This Month",
    dash_stat_customers: "Total Customers",
    dash_stat_completed: "Completed This Month",
    dash_nav_booking_list: "Booking List",
    dash_nav_customer_list: "Customer List",
    dash_nav_reports: "Reports",
    dash_nav_add_customer: "Add Customer",
    dash_nav_calendar: "Calendar",
    dash_nav_booking_settings: "Booking Settings",
    dash_nav_profile: "Business Profile",
    dash_nav_reminders: "Reminder Schedule",
    dash_nav_forum: "Forum & Help",

    forum_search_placeholder: "Search threads...",
    forum_new_thread_btn: "+ Start New Thread",

    dash_link_label: "Booking Link",
    dash_booking_settings_title: "Booking Settings",
    dash_booking_settings_desc: "Customers book their own slot from your personal link, no WhatsApp or calls needed to confirm a date. Once a booking is confirmed, deposit and reminder run automatically.",

    pricing_recommended: "Recommended",
    pricing_starter_feat1: "1 booking link, plus website embed",
    pricing_starter_feat2: "Unlimited service types (different durations, prices, capacities)",
    pricing_starter_feat3: "Automatic deposit and reminders, checked once a day",
    pricing_starter_feat4: "Self-serve reschedule and cancel",
    pricing_starter_feat5: "Multi-language (BM/EN/中文/தமிழ்) for customers",
    pricing_starter_feat6: "Cash-flow forecast and risk scoring",
    pricing_starter_feat7: "Monthly summary email",
    pricing_pro_feat1: "Everything in Starter",
    pricing_pro_feat2: "Up to 3 booking links, each fully independent",
    pricing_pro_feat3: "Reminders checked every 2 hours, not once a day",
    pricing_pro_feat4: "Weekly summary email instead of monthly",
    pricing_pro_feat5: "Pro badge on your forum posts",

    pricing_monthly: "Monthly",
    pricing_yearly: "Yearly <span class=\"plan-badge\">Save 2 Months</span>",
  },
  ms: {
    nav_login: "Log Masuk",
    nav_cta: "Mula Percuma",

    hero_eyebrow: "Booking & Client Manager untuk Business Owner Solo",
    hero_h1: "Customer book sendiri. Deposit dan reminder pun jalan sendiri.",
    hero_sub: "Untuk home baker, tutor, photographer, fitness coach: sesiapa yang pernah terlepas lead sebab reply WhatsApp lambat sikit. Bagi customer satu link untuk book terus dengan anda, dan deposit, invois, reminder semua jalan automatic lepas booking confirm.",
    hero_cta_primary: "Mula Percuma",
    hero_cta_secondary: "Tengok Butiran Lanjut",
    hero_trial_note: "Trial 14 hari, tak perlu kad",

    features_h2: "Semua yang anda perlukan, dalam satu tempat",
    feat_booking_title: "Booking Online",
    feat_booking_desc: "Customer pilih tarikh dan slot kosong, terus dari link peribadi anda.",
    feat_deposit_title: "Deposit dan Reminder Automatic",
    feat_deposit_desc: "Deposit terus dicaj. Reminder pun hantar sendiri, H-3, H-1, dan hari-ini.",
    feat_selfserve_title: "Customer Urus Sendiri",
    feat_selfserve_desc: "Reschedule atau cancel sendiri, dalam had notis yang anda set.",
    feat_multilang_title: "Pelbagai Bahasa",
    feat_multilang_desc: "Customer pilih bahasa sendiri. Emel dan portal ikut sekali.",
    feat_reports_title: "Laporan dan Analytics",
    feat_reports_desc: "Trend income, unjuran cash-flow, risk scoring, milestone bila dicapai.",
    feat_forum_title: "Forum Komuniti",
    feat_forum_desc: "Kongsi cerita, tanya soalan, dapat idea dari owner lain yang guna eqstudio.link.",

    compare_h2: "Cara Lama vs eqstudio.link",
    compare_lead: "Bukan ganti cara anda buat bisnes. Cuma ambil alih bahagian yang paling senang tercicir.",
    compare_old_title: "Cara Lama (WhatsApp / Buku Nota)",
    compare_old_1: "Customer tanya \"ada slot free tak\", anda lambat reply, dia dah book tempat lain.",
    compare_old_2: "Scroll balik chat lama untuk cari siapa belum bayar deposit.",
    compare_old_3: "Terlupa follow up sebab sibuk urus order lain.",
    compare_old_4: "Rasa tak sedap hati asyik kena tanya customer bila nak bayar.",
    compare_new_title: "Dengan eqstudio.link",
    compare_new_1: "Customer book slot sendiri dari link peribadi anda, bila-bila masa.",
    compare_new_2: "Deposit request auto hantar serta-merta lepas booking confirm.",
    compare_new_3: "Semua booking dan status pelanggan dalam satu dashboard.",
    compare_new_4: "Sistem yang kejar bayaran tu, bukan anda. Anda kekal professional.",

    pricing_h2: "Harga",
    pricing_lead: "Pilih pelan yang sesuai. Ambil tahunan, jimat 2 bulan.",
    pricing_starter: "Starter",
    pricing_pro: "Pro",
    pricing_cta: "Mula Percuma",

    faq_h2: "Soalan Lazim",
    faq_q1: "Macam mana booking online sebenarnya berfungsi?",
    faq_a1: "Anda dapat satu link peribadi (eqstudio.link/book.html?slug=...). Customer buka link tu, pilih tarikh dan slot kosong, isi maklumat, submit. Tak payah lagi WhatsApp bolak balik untuk confirm tarikh. Boleh embed terus dalam website sendiri, atau print QR code untuk letak kaunter.",
    faq_q2: "Bila deposit diminta, dan macam mana customer bayar?",
    faq_a2: "Serta merta lepas booking confirm, sistem terus hantar emel deposit request. Customer boleh pay online terus melalui butang \"Bayar Sekarang\", atau bank transfer manual dengan QR DuitNow (serasi TnG, Boost, GrabPay) kalau anda dah setkan dalam profil perniagaan.",
    faq_q3: "Boleh tanya customer soalan tambahan semasa booking?",
    faq_a3: "Boleh. Tambah \"Soalan Tambahan\" dalam Tetapan Booking, contoh \"Apa jenis kek?\" atau \"Saiz?\". Nanti muncul dalam borang booking lepas customer pilih slot, dan jawapan terus masuk dashboard anda.",
    faq_q4: "Boleh set waktu available dan buffer time?",
    faq_a4: "Boleh. Set hari dan jam operasi dalam Tetapan Booking, ada grid mingguan, senang klik je. Ada juga \"Buffer Time\" (0 hingga 30 minit) kalau nak rehat automatic antara setiap booking.",
    faq_q5: "Customer boleh reschedule atau cancel sendiri?",
    faq_a5: "Setiap emel confirmation booking ada butang \"Reschedule / Cancel\" terus. Customer pilih slot baru dari waktu available sebenar, atau cancel dengan sebab. Anda automatic dapat emel notification setiap kali ada perubahan.",
    faq_q6: "Ada invois rasmi?",
    faq_a6: "Ada. Setiap emel reminder auto lampir invois PDF, dan anda boleh muat turun bila-bila dari dashboard tanpa tunggu reminder cycle.",
    faq_q7: "Customer boleh semak status bayaran sendiri?",
    faq_a7: "Setiap emel ada link peribadi untuk customer semak status dah bayar atau belum, dan boleh settle terus. Tak perlu daftar akaun.",
    faq_q8: "Boleh ada lebih dari satu jenis servis dengan harga berbeza?",
    faq_a8: "Tambah \"Jenis Perkhidmatan\" (Event Types) dalam Tetapan Booking, contoh \"Collection Kek, 10 minit\" berbanding \"Kelas Baking, 2 jam, RM100\". Customer pilih jenis dulu semasa booking. Group class pun boleh, set kapasiti lebih dari 1 (contoh kelas Zumba, ramai orang book slot yang sama).",
    faq_q9: "Boleh buat booking percuma, macam konsultasi RM0?",
    faq_a9: "Taip 0 dalam field Deposit Lalai, atau set per jenis perkhidmatan. Sistem tak hantar emel \"sila bayar\" untuk booking percuma.",
    faq_q10: "Boleh run lebih dari satu bisnes dalam satu akaun?",
    faq_a10: "Untuk tu ada pelan Pro (RM39 sebulan atau RM390 setahun). Dapat sehingga 3 link booking, setiap satu dengan calendar, jenis perkhidmatan, dan tetapan deposit sendiri.",
    faq_q11: "Ada laporan atau analytics?",
    faq_a11: "Dashboard ada page Laporan yang tunjuk trend income, unjuran cash flow 6 minggu akan datang, dan risk scoring untuk kenal pasti customer yang selalu lambat bayar berdasarkan sejarah dengan anda.",
    faq_q12: "Customer boleh guna bahasa lain?",
    faq_a12: "Customer pilih bahasa sendiri masa booking, Bahasa Melayu, English, 中文, atau தமிழ். Emel dan portal mereka terus ikut bahasa yang dipilih.",
    faq_q13: "Macam mana bayaran berulang untuk repeat customer?",
    faq_a13: "Tandakan \"Bayaran Berulang\" bila tambah pelanggan, pilih interval (7, 14, 30, atau 60 hari). Sistem auto generate cycle baru bila customer dah bayar, anda tak perlu tambah manual setiap kali.",
    faq_q14: "Selamat ke data customer saya?",
    faq_a14: "Setiap akaun hanya nampak data customer sendiri, dikuatkuasakan di peringkat database, bukan setakat disorok dalam UI. Kami tak kongsi data anda dengan sesiapa. Rujuk <a href=\"/privacy-policy.html\">Dasar Privasi</a> kami untuk detail penuh.",
    faq_q15: "Perlu kad kredit untuk trial 14 hari?",
    faq_a15: "Tak perlu. Daftar dengan emel je, cuba dulu sebelum komited.",
    faq_q16: "Boleh cancel langganan bila-bila?",
    faq_a16: "Boleh, tiada kontrak jangka masa. Cancel terus dari dashboard bila-bila anda nak berhenti.",

    dash_stat_upcoming: "Booking Akan Datang",
    dash_stat_outstanding: "Belum Diterima",
    dash_stat_income_month: "Income Bulan Ini",
    dash_stat_customers: "Jumlah Pelanggan",
    dash_stat_completed: "Selesai Bulan Ini",
    dash_nav_booking_list: "Senarai Booking",
    dash_nav_customer_list: "Senarai Pelanggan",
    dash_nav_reports: "Laporan",
    dash_nav_add_customer: "Tambah Pelanggan",
    dash_nav_calendar: "Kalendar",
    dash_nav_booking_settings: "Tetapan Booking",
    dash_nav_profile: "Profil Perniagaan",
    dash_nav_reminders: "Jadual Reminder",
    dash_nav_forum: "Forum & Bantuan",

    forum_search_placeholder: "Cari thread...",
    forum_new_thread_btn: "+ Mula Thread Baharu",

    dash_link_label: "Link Booking",
    dash_booking_settings_title: "Tetapan Booking",
    dash_booking_settings_desc: "Customer boleh book slot terus dari link peribadi anda, tak payah WhatsApp atau call untuk confirm tarikh. Bila booking confirm, deposit dan reminder jalan automatic.",

    pricing_recommended: "Disyorkan",
    pricing_starter_feat1: "1 link booking, plus embed website",
    pricing_starter_feat2: "Jenis perkhidmatan tanpa had (tempoh, harga, kapasiti berbeza)",
    pricing_starter_feat3: "Deposit dan reminder automatic, disemak sekali sehari",
    pricing_starter_feat4: "Reschedule dan cancel self serve",
    pricing_starter_feat5: "Multi bahasa (BM/EN/中文/தமிழ்) untuk customer",
    pricing_starter_feat6: "Cash flow forecast dan risk scoring",
    pricing_starter_feat7: "Emel ringkasan bulanan",
    pricing_pro_feat1: "Semua dalam Starter",
    pricing_pro_feat2: "Sehingga 3 link booking, setiap satu independen sepenuhnya",
    pricing_pro_feat3: "Reminder disemak setiap 2 jam, bukan sekali sehari",
    pricing_pro_feat4: "Emel ringkasan mingguan, bukan bulanan",
    pricing_pro_feat5: "Badge Pro pada post forum anda",

    pricing_monthly: "Bulanan",
    pricing_yearly: "Tahunan <span class=\"plan-badge\">Jimat 2 Bulan</span>",
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
