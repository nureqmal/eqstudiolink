// demo-mock-client.js — powers Demo Mode (dashboard.html?demo=<niche>).
// Provides an in-memory drop-in replacement for the Supabase JS client so
// dashboard.html loads completely populated with realistic, bustling Malaysian
// business data without making any live Supabase calls.

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function isoDate(d) { return d.toISOString().slice(0, 10); }
function isoDateTime(d) { return d.toISOString(); }
function nextWeekday(fromDate, targetDow) {
  const d = new Date(fromDate);
  const diff = (targetDow - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

// ─────────────────────────────────────────────────────────────
// NICHE 1: FOTOGRAFI & STUDIO (Lensa Kreatif Studio)
// ─────────────────────────────────────────────────────────────
function buildLensaKreatifDataset() {
  const ownerId = "demo-lensa-uid";
  const linkId = "demo-link-lensa";
  const etSanding = "demo-et-sanding";
  const etPrewed = "demo-et-prewed";
  const etPotret = "demo-et-potret";
  const etKorporat = "demo-et-korporat";

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 1. Availability: Next 60 days across Thu, Fri, Sat, Sun
  const availability_dates = [];
  for (let i = 0; i < 60; i++) {
    const day = daysFromNow(i);
    const dow = day.getDay();
    if (dow === 4 || dow === 5 || dow === 6 || dow === 0) {
      availability_dates.push({
        id: `avail-lensa-${i}`,
        owner_id: ownerId,
        booking_link_id: linkId,
        specific_date: isoDate(day),
        start_time: "09:00:00",
        end_time: "19:00:00"
      });
    }
  }

  // 2. Bookings:
  // - 21 bookings in the past 14 days (for rich trend chart)
  // - 28 upcoming confirmed bookings
  // - 4 pending (tertunda / menunggu deposit)
  // - 3 completed
  // - 2 cancelled
  const bookings = [];

  const past14Distribution = [
    { daysAgo: 13, count: 1, et: etPotret, name: "Dr. Farah Hanim", phone: "012-334 1122", fee: 400 },
    { daysAgo: 12, count: 1, et: etPrewed, name: "Izzat & Natasha", phone: "013-998 7766", fee: 1200 },
    { daysAgo: 11, count: 2, et: etSanding, name: "Zulhelmi & Adila", phone: "019-445 6677", fee: 2800 },
    { daysAgo: 10, count: 1, et: etPotret, name: "Keluarga Dato' Razak", phone: "017-889 0011", fee: 450 },
    { daysAgo: 9,  count: 1, et: etKorporat, name: "Petronas Digital Team", phone: "013-556 7788", fee: 1800 },
    { daysAgo: 8,  count: 2, et: etSanding, name: "Hafiz & Syaza", phone: "012-778 9900", fee: 3500 },
    { daysAgo: 7,  count: 1, et: etPrewed, name: "Daniel & Melissa", phone: "016-223 3445", fee: 1200 },
    { daysAgo: 6,  count: 1, et: etPotret, name: "Siti Sarah (Graduan UM)", phone: "018-990 1122", fee: 296 },
    { daysAgo: 5,  count: 2, et: etSanding, name: "Khairul & Ain", phone: "019-332 2110", fee: 2800 },
    { daysAgo: 4,  count: 2, et: etPrewed, name: "Syafiq & Nureen", phone: "011-234 5678", fee: 1200 },
    { daysAgo: 3,  count: 1, et: etPotret, name: "Keluarga En. Roslan", phone: "014-556 7890", fee: 400 },
    { daysAgo: 2,  count: 3, et: etSanding, name: "Amirul & Farah", phone: "013-556 7788", fee: 2800 },
    { daysAgo: 1,  count: 2, et: etKorporat, name: "Sime Darby Property", phone: "012-445 6678", fee: 1800 },
    { daysAgo: 0,  count: 1, et: etPotret, name: "Afiqah & Friends (Studio)", phone: "017-334 5566", fee: 350 }
  ];

  let bkIdx = 1;
  for (const item of past14Distribution) {
    const slotD = daysFromNow(-item.daysAgo);
    slotD.setHours(10, 0, 0, 0);
    bookings.push({
      id: `demo-bk-${bkIdx}`,
      owner_id: ownerId,
      booking_link_id: linkId,
      event_type_id: item.et,
      customer_id: `demo-cust-${bkIdx}`,
      customer_name: item.name,
      customer_email: `cust${bkIdx}@example.com`,
      customer_phone: item.phone,
      slot_datetime: isoDateTime(slotD),
      duration_minutes: item.et === etSanding ? 480 : (item.et === etPrewed ? 240 : 90),
      status: "confirmed",
      deposit_amount: item.fee > 1000 ? 500 : 150,
      deposit_paid: true,
      custom_answers: {
        "Lokasi majlis atau lokasi photoshoot yang dikehendaki?": "Dewan Perdana Felda / Studio Lensa Kreatif",
        "Tema pakaian atau konsep warna utama?": "Pastel Peach & Champagne",
        "Bilangan tetamu atau bilangan ahli keluarga terlibat?": "500 tetamu / 2 kru"
      },
      created_at: isoDateTime(daysFromNow(-item.daysAgo - 2))
    });
    bkIdx++;
  }

  // Upcoming 28 confirmed bookings across next 40 days
  const upcomingClients = [
    { name: "Syakir & Nabila", day: 1, time: 10, et: etSanding, phone: "013-889 0012", loc: "Dewan Melati Putrajaya" },
    { name: "Keluarga Zulkifli", day: 2, time: 14, et: etPotret, phone: "019-223 4455", loc: "Studio Lensa Kreatif" },
    { name: "Faris & Dania", day: 4, time: 9, et: etPrewed, phone: "017-665 4433", loc: "Pantai Klebang Melaka" },
    { name: "Hotel Impiana (Gala Dinner)", day: 5, time: 18, et: etKorporat, phone: "012-990 1122", loc: "Grand Ballroom Impiana KL" },
    { name: "Akmal & Fatin", day: 6, time: 10, et: etSanding, phone: "011-334 5567", loc: "Masjid Wilayah KL" },
    { name: "Keluarga Dr. Azlan", day: 7, time: 15, et: etPotret, phone: "018-778 9901", loc: "Studio Lensa Kreatif" },
    { name: "Irfan & Hajar", day: 8, time: 11, et: etPrewed, phone: "014-223 9988", loc: "Taman Saujana Hijau Putrajaya" },
    { name: "Bank Islam Annual Dinner", day: 11, time: 19, et: etKorporat, phone: "013-445 6677", loc: "Mandarin Oriental KL" },
    { name: "Zharif & Shuhada", day: 12, time: 9, et: etSanding, phone: "019-556 7788", loc: "Glasshouse at Seputeh" },
    { name: "Keluarga Pn. Zaidah", day: 13, time: 16, et: etPotret, phone: "012-667 8899", loc: "Studio Lensa Kreatif" },
    { name: "Najib & Wani", day: 15, time: 10, et: etSanding, phone: "017-445 2211", loc: "Dewan Seri Endon Putrajaya" },
    { name: "Aiman & Diyana", day: 18, time: 9, et: etPrewed, phone: "013-112 3344", loc: "Bukit Fraser Pahang" },
    { name: "Keluarga Lee & Tan", day: 19, time: 14, et: etPotret, phone: "016-554 3322", loc: "Studio Lensa Kreatif" },
    { name: "Tengku Iskandar & Diana", day: 20, time: 10, et: etSanding, phone: "012-887 6655", loc: "Royale Chulan Damansara" },
    { name: "Nestle Malaysia Product Shoot", day: 22, time: 13, et: etKorporat, phone: "019-998 8776", loc: "Studio Lensa Kreatif (Bay 1)" },
    { name: "Haziq & Batrisyia", day: 25, time: 10, et: etSanding, phone: "017-334 6677", loc: "Boraombak Marina Putrajaya" },
    { name: "Sesi Graduan UKM", day: 26, time: 15, et: etPotret, phone: "018-223 4455", loc: "Studio Lensa Kreatif" },
    { name: "Shahril & Yasmin", day: 27, time: 9, et: etPrewed, phone: "014-778 9900", loc: "Astaka Morocco Putrajaya" },
    { name: "Danial & Sarah", day: 29, time: 10, et: etSanding, phone: "013-990 1122", loc: "Dewan Banquet Menara Felda" },
    { name: "Keluarga En. Hassan", day: 32, time: 14, et: etPotret, phone: "012-332 1144", loc: "Studio Lensa Kreatif" },
    { name: "Faizal & Natasha", day: 33, time: 10, et: etSanding, phone: "019-445 8899", loc: "Lakeside Terrace Cyberjaya" },
    { name: "Grab Malaysia Townhall", day: 34, time: 14, et: etKorporat, phone: "017-556 4433", loc: "Hilton Petaling Jaya" },
    { name: "Luqman & Athirah", day: 36, time: 9, et: etPrewed, phone: "018-887 9900", loc: "Sekinchan Paddy Field" },
    { name: "Keluarga Pn. Salmah", day: 37, time: 15, et: etPotret, phone: "016-778 2211", loc: "Studio Lensa Kreatif" },
    { name: "Aidil & Zahra", day: 39, time: 10, et: etSanding, phone: "013-667 8899", loc: "Magica Grand Ballroom Subang" },
    { name: "Khairin & Maisarah", day: 40, time: 9, et: etPrewed, phone: "012-223 5566", loc: "Taman Botani Shah Alam" },
    { name: "Keluarga En. Mutalib", day: 42, time: 14, et: etPotret, phone: "019-334 7788", loc: "Studio Lensa Kreatif" },
    { name: "Rizal & Anis", day: 44, time: 10, et: etSanding, phone: "017-889 4455", loc: "Dewan Perdana Wisma Sejarah KL" }
  ];

  for (const uc of upcomingClients) {
    const slotD = daysFromNow(uc.day);
    slotD.setHours(uc.time, 0, 0, 0);
    bookings.push({
      id: `demo-bk-${bkIdx}`,
      owner_id: ownerId,
      booking_link_id: linkId,
      event_type_id: uc.et,
      customer_id: `demo-cust-${bkIdx}`,
      customer_name: uc.name,
      customer_email: `cust${bkIdx}@example.com`,
      customer_phone: uc.phone,
      slot_datetime: isoDateTime(slotD),
      duration_minutes: uc.et === etSanding ? 480 : (uc.et === etPrewed ? 240 : 90),
      status: "confirmed",
      deposit_amount: uc.et === etSanding ? 500 : (uc.et === etPrewed ? 300 : 150),
      deposit_paid: true,
      custom_answers: {
        "Lokasi majlis atau lokasi photoshoot yang dikehendaki?": uc.loc,
        "Tema pakaian atau konsep warna utama?": "Tema Majlis & Busana Eksklusif",
        "Bilangan tetamu atau bilangan ahli keluarga terlibat?": "Ikut pakej tempahan"
      },
      created_at: isoDateTime(daysFromNow(-2))
    });
    bkIdx++;
  }

  // 4 Pending Bookings (menunggu deposit / tertunda)
  const pendingBookings = [
    { name: "Kamal & Haryati", day: 3, et: etSanding, phone: "013-998 1122", loc: "Dewan Sivik MBPJ" },
    { name: "Wan Firdaus (Studio Solo)", day: 5, et: etPotret, phone: "019-887 2233", loc: "Studio Lensa Kreatif" },
    { name: "Syafeeq & Nadiah", day: 9, et: etPrewed, phone: "017-223 9900", loc: "Cyberjaya Lake Gardens" },
    { name: "Keluarga En. Rosli", day: 14, et: etPotret, phone: "012-556 4433", loc: "Studio Lensa Kreatif" }
  ];
  for (const pb of pendingBookings) {
    const slotD = daysFromNow(pb.day);
    slotD.setHours(11, 0, 0, 0);
    bookings.push({
      id: `demo-bk-${bkIdx}`,
      owner_id: ownerId,
      booking_link_id: linkId,
      event_type_id: pb.et,
      customer_id: `demo-cust-${bkIdx}`,
      customer_name: pb.name,
      customer_email: `cust${bkIdx}@example.com`,
      customer_phone: pb.phone,
      slot_datetime: isoDateTime(slotD),
      duration_minutes: 120,
      status: "pending",
      deposit_amount: 300,
      deposit_paid: false,
      custom_answers: {
        "Lokasi majlis atau lokasi photoshoot yang dikehendaki?": pb.loc
      },
      created_at: isoDateTime(daysFromNow(-1))
    });
    bkIdx++;
  }

  // 3 Completed Bookings
  const completedBookings = [
    { name: "Zack & Sherry", day: -18, et: etSanding, phone: "012-334 5566", loc: "Hotel Istana KL" },
    { name: "Keluarga Tan Sri Halim", day: -22, et: etPotret, phone: "019-223 1100", loc: "Studio Lensa Kreatif" },
    { name: "Maxis Corporate Shoot", day: -25, et: etKorporat, phone: "013-445 9988", loc: "Menara Maxis KLCC" }
  ];
  for (const cb of completedBookings) {
    const slotD = daysFromNow(cb.day);
    slotD.setHours(10, 0, 0, 0);
    bookings.push({
      id: `demo-bk-${bkIdx}`,
      owner_id: ownerId,
      booking_link_id: linkId,
      event_type_id: cb.et,
      customer_id: `demo-cust-${bkIdx}`,
      customer_name: cb.name,
      customer_email: `cust${bkIdx}@example.com`,
      customer_phone: cb.phone,
      slot_datetime: isoDateTime(slotD),
      duration_minutes: 240,
      status: "completed",
      deposit_amount: 500,
      deposit_paid: true,
      created_at: isoDateTime(daysFromNow(cb.day - 7))
    });
    bkIdx++;
  }

  // 2 Cancelled Bookings
  const cancelledBookings = [
    { name: "Siti & Norman (Tukar Tarikh)", day: 10, et: etSanding, phone: "017-889 2211" },
    { name: "Studio Graduation Group", day: -8, et: etPotret, phone: "011-332 4455" }
  ];
  for (const cnb of cancelledBookings) {
    const slotD = daysFromNow(cnb.day);
    bookings.push({
      id: `demo-bk-${bkIdx}`,
      owner_id: ownerId,
      booking_link_id: linkId,
      event_type_id: cnb.et,
      customer_id: `demo-cust-${bkIdx}`,
      customer_name: cnb.name,
      customer_email: `cust${bkIdx}@example.com`,
      customer_phone: cnb.phone,
      slot_datetime: isoDateTime(slotD),
      duration_minutes: 180,
      status: "cancelled",
      deposit_amount: 200,
      deposit_paid: false,
      created_at: isoDateTime(daysFromNow(-10))
    });
    bkIdx++;
  }

  // 3. Customers: EXACTLY 591 customers!
  // Target:
  // - Income this month = exactly RM 15,996.00!
  // - Outstanding = RM 7,150.00!
  // - Total customers = 591
  const customers = [];
  let custId = 1;

  // Cohort A: Paid customers whose paid_at starts with thisMonthKey
  // Amounts: [3500, 2800, 2800, 1800, 1500, 1200, 1200, 500, 400, 296] => SUM = 15996
  const thisMonthPaidList = [
    { name: "Hafiz & Syaza (Pakej Sanding Signature)", amount: 3500, bId: "demo-bk-6", phone: "012-778 9900", daysAgo: 8, label: "Bayaran Penuh Pakej Signature" },
    { name: "Zulhelmi & Adila (Nikah & Sanding)", amount: 2800, bId: "demo-bk-3", phone: "019-445 6677", daysAgo: 11, label: "Baki Penuh Majlis" },
    { name: "Amirul & Farah (Pakej Sanding)", amount: 2800, bId: "demo-bk-12", phone: "013-556 7788", daysAgo: 2, label: "Baki Majlis Resepsi" },
    { name: "Petronas Digital Team (Liputan Acara)", amount: 1800, bId: "demo-bk-5", phone: "013-556 7788", daysAgo: 9, label: "Invois Rasmi Acara Korporat" },
    { name: "Khairul & Ain (Baki Hari Majlis)", amount: 1500, bId: "demo-bk-9", phone: "019-332 2110", daysAgo: 5, label: "Baki Hari Majlis" },
    { name: "Izzat & Natasha (Pre-Wedding Cinematic)", amount: 1200, bId: "demo-bk-2", phone: "013-998 7766", daysAgo: 12, label: "Bayaran Penuh Pre-Wed" },
    { name: "Daniel & Melissa (Outdoor Pre-Wed)", amount: 1200, bId: "demo-bk-7", phone: "016-223 3445", daysAgo: 7, label: "Bayaran Penuh Pre-Wed" },
    { name: "Sime Darby Property (Deposit Pelancaran)", amount: 500, bId: "demo-bk-13", phone: "012-445 6678", daysAgo: 1, label: "Deposit Tempahan Slot" },
    { name: "Keluarga En. Roslan (Potret Studio)", amount: 400, bId: "demo-bk-11", phone: "014-556 7890", daysAgo: 3, label: "Sesi Studio + Cetakan Kayu" },
    { name: "Siti Sarah (Graduan UM Konvo)", amount: 296, bId: "demo-bk-8", phone: "018-990 1122", daysAgo: 6, label: "Pakej Studio Graduan" }
  ];

  for (const p of thisMonthPaidList) {
    const paidDate = daysFromNow(-p.daysAgo);
    // Ensure paidDate month matches thisMonthKey
    const paidIso = `${thisMonthKey}-${String(paidDate.getDate()).padStart(2, "0")}T11:00:00.000Z`;
    customers.push({
      id: `demo-cust-${custId}`,
      owner_id: ownerId,
      booking_id: p.bId,
      name: p.name,
      contact_email: `client${custId}@example.com`,
      email: `client${custId}@example.com`,
      phone: p.phone,
      contact_phone: p.phone,
      amount: p.amount,
      status: "dah_bayar",
      paid_at: paidIso,
      due_date: paidIso.slice(0, 10),
      milestone_label: p.label,
      notes: "Bayaran disahkan melalui DuitNow QR rasmi",
      is_recurring: false,
      created_at: paidIso
    });
    custId++;
  }

  // Cohort B: Unpaid & Reminder Sent customers (Outstanding = RM 7,150.00)
  // Unpaid amounts: [1200, 800, 800, 650, 600, 500, 500, 500, 450, 400, 400, 350] => 7150
  const unpaidList = [
    { name: "Syakir & Nabila (Baki Majlis Putrajaya)", amount: 1200, status: "belum_bayar", dueDays: 1, phone: "013-889 0012", label: "Baki Hari Majlis" },
    { name: "Akmal & Fatin (Baki Majlis Sanding)", amount: 800, status: "belum_bayar", dueDays: 6, phone: "011-334 5567", label: "Baki Majlis Sanding" },
    { name: "Hotel Impiana (Invois Baki Gala Dinner)", amount: 800, status: "reminder_dihantar", dueDays: 4, phone: "012-990 1122", label: "Invois Baki Rasmi" },
    { name: "Zharif & Shuhada (Baki Pakej Seputeh)", amount: 650, status: "belum_bayar", dueDays: 11, phone: "019-556 7788", label: "Baki Majlis Sanding" },
    { name: "Faris & Dania (Baki Pre-Wedding Klebang)", amount: 600, status: "belum_bayar", dueDays: 3, phone: "017-665 4433", label: "Baki Sesi Photoshoot" },
    { name: "Tengku Iskandar (Deposit Lock Tarikh)", amount: 500, status: "reminder_dihantar", dueDays: 2, phone: "012-887 6655", label: "Deposit Tempahan" },
    { name: "Kamal & Haryati (Deposit Sanding MBPJ)", amount: 500, status: "belum_bayar", dueDays: 3, phone: "013-998 1122", label: "Deposit Tempahan" },
    { name: "Najib & Wani (Baki Album & Kristal)", amount: 500, status: "reminder_dihantar", dueDays: 14, phone: "017-445 2211", label: "Baki Penyerahan Album" },
    { name: "Irfan & Hajar (Baki Sesi Putrajaya)", amount: 450, status: "belum_bayar", dueDays: 7, phone: "014-223 9988", label: "Baki Outdoor Photoshoot" },
    { name: "Keluarga Dr. Azlan (Sesi Studio & Frame)", amount: 400, status: "belum_bayar", dueDays: 6, phone: "018-778 9901", label: "Baki Sesi & Frame Kayu" },
    { name: "Keluarga Zulkifli (Baki Sesi Studio)", amount: 400, status: "reminder_dihantar", dueDays: 2, phone: "019-223 4455", label: "Baki Sesi Studio" },
    { name: "Afiqah (Baki Studio Graduation Group)", amount: 350, status: "belum_bayar", dueDays: 5, phone: "017-334 5566", label: "Baki Sesi Studio" }
  ];

  for (const u of unpaidList) {
    const dueD = daysFromNow(u.dueDays);
    customers.push({
      id: `demo-cust-${custId}`,
      owner_id: ownerId,
      booking_id: `demo-bk-${custId}`,
      name: u.name,
      contact_email: `client${custId}@example.com`,
      email: `client${custId}@example.com`,
      phone: u.phone,
      contact_phone: u.phone,
      amount: u.amount,
      status: u.status,
      paid_at: null,
      due_date: isoDate(dueD),
      milestone_label: u.label,
      notes: "Menunggu resit pemindahan bank pelanggan",
      is_recurring: false,
      created_at: isoDateTime(daysFromNow(-4))
    });
    custId++;
  }

  // Cohort C: Additional active wedding milestone rows (Deposit already paid in prior months)
  const depositPaidMilestones = [
    { name: "Syakir & Nabila (Deposit)", amount: 500, phone: "013-889 0012", bId: "demo-bk-15" },
    { name: "Akmal & Fatin (Deposit)", amount: 500, phone: "011-334 5567", bId: "demo-bk-19" },
    { name: "Hotel Impiana (Deposit)", amount: 1000, phone: "012-990 1122", bId: "demo-bk-18" },
    { name: "Zharif & Shuhada (Deposit)", amount: 500, phone: "019-556 7788", bId: "demo-bk-23" },
    { name: "Faris & Dania (Deposit)", amount: 300, phone: "017-665 4433", bId: "demo-bk-17" },
    { name: "Irfan & Hajar (Deposit)", amount: 300, phone: "014-223 9988", bId: "demo-bk-21" },
    { name: "Najib & Wani (Deposit)", amount: 500, phone: "017-445 2211", bId: "demo-bk-25" },
    { name: "Aiman & Diyana (Deposit)", amount: 300, phone: "013-112 3344", bId: "demo-bk-26" }
  ];
  for (const dm of depositPaidMilestones) {
    const pDate = daysFromNow(-45); // Paid last month
    customers.push({
      id: `demo-cust-${custId}`,
      owner_id: ownerId,
      booking_id: dm.bId,
      name: dm.name,
      contact_email: `client${custId}@example.com`,
      email: `client${custId}@example.com`,
      phone: dm.phone,
      contact_phone: dm.phone,
      amount: dm.amount,
      status: "dah_bayar",
      paid_at: isoDateTime(pDate),
      due_date: isoDate(pDate),
      milestone_label: "Deposit Tempahan",
      notes: "Deposit disahkan",
      is_recurring: false,
      created_at: isoDateTime(pDate)
    });
    custId++;
  }

  // Cohort D: Historical archival records to bring total exactly to 591!
  // Current count = custId - 1. Needed = 591 - (custId - 1).
  const needed = 591 - (custId - 1);
  const sampleNames = [
    "Khairul Anuar", "Noraini Ahmad", "Wan Mohd Faizal", "Tengku Aishah", "Mohd Syazwan",
    "Fatin Farzana", "Muhammad Luqman", "Nurul Hidayah", "Ahmad Tarmizi", "Nur Syahirah",
    "Siti Zubaidah", "Mohamad Daniel", "Sharifah Balqis", "Megat Iskandar", "Nurul Atiqah"
  ];

  for (let i = 0; i < needed; i++) {
    const pastDays = 35 + (i * 2);
    const pDate = daysFromNow(-pastDays);
    const n = sampleNames[i % sampleNames.length];
    customers.push({
      id: `demo-cust-${custId}`,
      owner_id: ownerId,
      booking_id: null,
      name: `${n} #${591 - i}`,
      contact_email: `client${custId}@example.com`,
      email: `client${custId}@example.com`,
      phone: `01${(i % 8) + 2}-${String(100 + (i * 7) % 900)} ${String(1000 + (i * 13) % 9000)}`,
      contact_phone: `01${(i % 8) + 2}-${String(100 + (i * 7) % 900)} ${String(1000 + (i * 13) % 9000)}`,
      amount: 300 + ((i * 50) % 1500),
      status: "dah_bayar",
      paid_at: isoDateTime(pDate),
      due_date: isoDate(pDate),
      milestone_label: "Bayaran Penuh",
      notes: "Selesai arkib",
      is_recurring: false,
      created_at: isoDateTime(pDate)
    });
    custId++;
  }

  // 4. Notifications (Multiple realistic unread & read notifications)
  const notifications = [
    {
      id: "demo-notif-1",
      owner_id: ownerId,
      type: "new_booking",
      title: "Tempahan Baharu Diterima",
      message: "Syakir & Nabila menempah Pakej Sanding Signature (Dewan Melati Putrajaya)",
      link_url: "/dashboard.html?page=booking-list",
      is_read: false,
      created_at: isoDateTime(daysFromNow(0))
    },
    {
      id: "demo-notif-2",
      owner_id: ownerId,
      type: "deposit_paid",
      title: "Deposit DuitNow Disahkan",
      message: "RM500 deposit diterima daripada Faris & Dania (Pre-Wedding Klebang)",
      link_url: "/dashboard.html?page=customer-list",
      is_read: false,
      created_at: isoDateTime(daysFromNow(-1))
    },
    {
      id: "demo-notif-3",
      owner_id: ownerId,
      type: "reminder_due",
      title: "Peringatan Baki Majlis",
      message: "Majlis Akmal & Fatin berbaki 6 hari. Baki RM800 belum dijelaskan.",
      link_url: "/dashboard.html?page=customer-list",
      is_read: false,
      created_at: isoDateTime(daysFromNow(-1))
    },
    {
      id: "demo-notif-4",
      owner_id: ownerId,
      type: "chat_message",
      title: "Mesej Baharu Pelanggan",
      message: "Amirul & Farah: 'Link baki bayaran guna DuitNow yang sama kan?'",
      link_url: "/dashboard.html?page=chat",
      is_read: false,
      created_at: isoDateTime(daysFromNow(-1))
    },
    {
      id: "demo-notif-5",
      owner_id: ownerId,
      type: "reschedule",
      title: "Permintaan Penukaran Tarikh",
      message: "Keluarga Pn. Zaidah ingin anjakkan slot studio ke jam 4 petang Ahad depan.",
      link_url: "/dashboard.html?page=booking-list",
      is_read: true,
      created_at: isoDateTime(daysFromNow(-3))
    },
    {
      id: "demo-notif-6",
      owner_id: ownerId,
      type: "auto_reminder",
      title: "Automasi Emel Peringatan Berjaya",
      message: "Emel peringatan & pautan DuitNow dihantar kepada 4 pelanggan majlis minggu ini.",
      link_url: "/dashboard.html?page=customer-list",
      is_read: true,
      created_at: isoDateTime(daysFromNow(-4))
    },
    {
      id: "demo-notif-7",
      owner_id: ownerId,
      type: "review",
      title: "Ulasan 5 Bintang Diterima",
      message: "Hafiz & Syaza: 'Sangat puas hati dengan gambar nikah! Servis pantas & kualiti mantap.'",
      link_url: "/dashboard.html?page=booking-settings",
      is_read: true,
      created_at: isoDateTime(daysFromNow(-6))
    },
    {
      id: "demo-notif-8",
      owner_id: ownerId,
      type: "system",
      title: "Penyelarasan Bank Selesai",
      message: "Padanan automatik 8 transaksi masuk DuitNow berjaya disahkan ke sistem.",
      link_url: "/dashboard.html?page=laporan",
      is_read: true,
      created_at: isoDateTime(daysFromNow(-7))
    }
  ];

  // 5. Chat Messages (Realistic back-and-forth threads)
  const chat_messages = [
    // Thread 1: Amirul & Farah (Cust ID: demo-cust-3)
    {
      id: "msg-101",
      customer_id: "demo-cust-3",
      sender_type: "customer",
      message_text: "Salam bro, gambar nikah kami dah siap edit ke? Tak sabar nak tengok hehe",
      created_at: isoDateTime(daysFromNow(-2)),
      read_by_owner: true
    },
    {
      id: "msg-102",
      customer_id: "demo-cust-3",
      sender_type: "owner",
      message_text: "Waalaikumussalam Amirul! Dah 90% siap, tinggal album layout je. Esok petang saya share link Google Drive ya!",
      created_at: isoDateTime(daysFromNow(-1)),
      read_by_owner: true
    },
    {
      id: "msg-103",
      customer_id: "demo-cust-3",
      sender_type: "customer",
      message_text: "Alhamdulillah terbaik bro, terima kasih banyak! Link baki bayaran guna DuitNow yang sama kan?",
      created_at: isoDateTime(daysFromNow(0)),
      read_by_owner: false // Unread!
    },

    // Thread 2: Syakir & Nabila (Cust ID: demo-cust-11)
    {
      id: "msg-201",
      customer_id: "demo-cust-11",
      sender_type: "customer",
      message_text: "Hi Lensa Studio, kami dah bayar deposit RM500 tadi ikut link booking. Ni resit Maybank.",
      created_at: isoDateTime(daysFromNow(-1)),
      read_by_owner: true
    },
    {
      id: "msg-202",
      customer_id: "demo-cust-11",
      sender_type: "owner",
      message_text: "Terima kasih Nabila & Syakir! Deposit sudah kami sahkan dalam sistem. Jumpa masa sesi fitting & briefing nanti ya.",
      created_at: isoDateTime(daysFromNow(-1)),
      read_by_owner: true
    },

    // Thread 3: Keluarga Zulkifli (Cust ID: demo-cust-21)
    {
      id: "msg-301",
      customer_id: "demo-cust-21",
      sender_type: "customer",
      message_text: "Salam, untuk photoshoot studio sabtu ni boleh kami bawa prop sendiri macam belon dan bunga segar?",
      created_at: isoDateTime(daysFromNow(-3)),
      read_by_owner: true
    },
    {
      id: "msg-302",
      customer_id: "demo-cust-21",
      sender_type: "owner",
      message_text: "Boleh sangat Puan! Studio kami sedia backdrop putih dan natural wood. Datang 15 minit awal ya untuk touch-up.",
      created_at: isoDateTime(daysFromNow(-2)),
      read_by_owner: true
    },

    // Thread 4: Hotel Impiana (Cust ID: demo-cust-13)
    {
      id: "msg-401",
      customer_id: "demo-cust-13",
      sender_type: "customer",
      message_text: "Salam Lensa Kreatif, boleh kami dapatkan invoice rasmi untuk payment baki RM800 sebelum hari Jumaat?",
      created_at: isoDateTime(daysFromNow(-2)),
      read_by_owner: true
    },
    {
      id: "msg-402",
      customer_id: "demo-cust-13",
      sender_type: "owner",
      message_text: "Salam, sudah tentu. Invoice rasmi #INV-2026-088 telah dijana dan dihantar ke emel korporat tuan.",
      created_at: isoDateTime(daysFromNow(-1)),
      read_by_owner: true
    }
  ];

  // 6. Chat FAQ Templates
  const chat_faq_templates = [
    {
      id: "faq-1",
      owner_id: ownerId,
      title: "Cara Bayaran Deposit & Baki",
      text: "Sila imbas DuitNow QR rasmi studio kami atau transfer ke akaun CIMB 7008 1122 3344 (Lensa Kreatif Studio). Resit akan disahkan serta-merta."
    },
    {
      id: "faq-2",
      owner_id: ownerId,
      title: "Tempoh Siap Gambar & Album",
      text: "Foto preview digital akan siap dalam tempoh 7 hari bekerja. Album fizikal dan pendrive kayu diserahkan dalam tempoh 3-4 minggu selepas pemilihan gambar."
    },
    {
      id: "faq-3",
      owner_id: ownerId,
      title: "Polisi Penukaran Tarikh Majlis",
      text: "Penukaran tarikh dibenarkan secara percuma sekiranya dimaklumkan sekurang-kurangnya 14 hari sebelum tarikh majlis, tertakluk kepada kekosongan slot."
    }
  ];

  // 7. Equipment
  const equipment = [
    { id: "eq-1", owner_id: ownerId, name: "Sony A7 IV (Body Utama A)", category: "Kamera", status: "Tersedia", location: "Studio Cabinet A" },
    { id: "eq-2", owner_id: ownerId, name: "Sony A7 III (Body Backup B)", category: "Kamera", status: "Tersedia", location: "Drybox 1" },
    { id: "eq-3", owner_id: ownerId, name: "Sony GM 24-70mm f/2.8 II", category: "Lensa", status: "Tersedia", location: "Lens Pouch 1" },
    { id: "eq-4", owner_id: ownerId, name: "Sony GM 70-200mm f/2.8 OSS II", category: "Lensa", status: "Sedang Digunakan", location: "Kru 2 (Outdoor)" },
    { id: "eq-5", owner_id: ownerId, name: "Godox AD600 Pro + Octabox 120cm", category: "Lighting", status: "Tersedia", location: "Studio Bay 1" },
    { id: "eq-6", owner_id: ownerId, name: "DJI RS3 Pro Gimbal", category: "Stabilizer", status: "Tersedia", location: "Hard Case" }
  ];

  // 8. Leads (Sales Pipeline)
  const leads = [
    { id: "lead-1", owner_id: ownerId, name: "Tengku Iskandar", phone: "012-887 6655", email: "iskandar@example.com", package_name: "Pakej Sanding Royale Chulan (RM3,800)", status: "Berminat", notes: "Tarikh Disember, minta tambah 1 videographer drone.", created_at: isoDateTime(daysFromNow(-2)) },
    { id: "lead-2", owner_id: ownerId, name: "Fatin Athirah", phone: "013-445 7788", email: "fatin@example.com", package_name: "Outdoor Pre-Wedding Cameron Highlands", status: "Dihubungi", notes: "Konsep sejuk & kabus pagi.", created_at: isoDateTime(daysFromNow(-3)) },
    { id: "lead-3", owner_id: ownerId, name: "Bank Islam HQ", phone: "019-332 1100", email: "events.bi@example.com", package_name: "Liputan Annual Dinner 2026", status: "Baru", notes: "Perlu quotation rasmi untuk bahagian HR.", created_at: isoDateTime(daysFromNow(-1)) },
    { id: "lead-4", owner_id: ownerId, name: "Dr. Azlan", phone: "018-778 9901", email: "azlan@example.com", package_name: "Sesi Studio Konvokesyen Keluarga", status: "Menunggu Keputusan", notes: "Tunggu anak sulung balik bercuti.", created_at: isoDateTime(daysFromNow(-5)) }
  ];

  // 9. Expenses (Studio operational costs)
  const expenses = [
    { id: "exp-1", owner_id: ownerId, title: "Sewa Studio & Utiliti Bulan Ini", amount: 2200, category: "Sewa & Utiliti", expense_date: isoDate(daysFromNow(-5)) },
    { id: "exp-2", owner_id: ownerId, title: "Pencetakan Premium Photobook & Kotak Kayu", amount: 1450, category: "Kos Produk", expense_date: isoDate(daysFromNow(-8)) },
    { id: "exp-3", owner_id: ownerId, title: "Bayaran Freelance 2nd Shooter & Assistant", amount: 900, category: "Upah Kru", expense_date: isoDate(daysFromNow(-11)) },
    { id: "exp-4", owner_id: ownerId, title: "Cucian Sensor & Servis Lens", amount: 350, category: "Penyelenggaraan", expense_date: isoDate(daysFromNow(-15)) }
  ];

  // 10. Testimonials & Gallery Images
  const testimonials = [
    { id: "t-1", owner_id: ownerId, customer_name: "Amirul & Farah", quote_text: "Gambar sanding memang luar biasa cantik! Kami paling suka sebab studio guna sistem link booking & peringatan baki automatik yang sangat profesional.", sort_order: 0 },
    { id: "t-2", owner_id: ownerId, customer_name: "Hafiz & Syaza", quote_text: "Tak payah pening kepala pasal clash tarikh. Semua maklumat dewan dan shot list tersusun kemas dari hari pertama.", sort_order: 1 },
    { id: "t-3", owner_id: ownerId, customer_name: "Dr. Farah Hanim", quote_text: "Sesi potret studio sekeluarga sangat lancar, anak-anak selesa dengan kru dan cetakan kayu 8R berkualiti tinggi.", sort_order: 2 }
  ];

  const gallery_images = [
    { id: "gal-1", owner_id: ownerId, image_url: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80", sort_order: 0 },
    { id: "gal-2", owner_id: ownerId, image_url: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop&q=80", sort_order: 1 },
    { id: "gal-3", owner_id: ownerId, image_url: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=800&auto=format&fit=crop&q=80", sort_order: 2 },
    { id: "gal-4", owner_id: ownerId, image_url: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=800&auto=format&fit=crop&q=80", sort_order: 3 }
  ];

  return {
    user: { id: ownerId, email: "demo-lensa@eqstudio.link" },
    profiles: [{
      id: ownerId,
      business_name: "Lensa Kreatif Studio",
      contact_phone: "013-778 9900",
      contact_email: "lensakreatif@eqstudio.link",
      business_address: "No. 12B, Jalan Bandar Utama, 47800 Petaling Jaya, Selangor",
      logo_url: null,
      brand_color: "#1a1a2e",
      bank_name: "CIMB Bank",
      bank_account_number: "7008 1122 3344",
      bank_account_holder: "Lensa Kreatif Studio Enterprise",
      qr_code_url: null,
      ssm_number: "202401987654 (003456789-V)",
      tier: "pro",
      subscription_status: "active",
      subscription_end_date: isoDate(daysFromNow(365)),
      is_suspended: false,
      booking_slug: "lensa-kreatif",
      default_deposit_amount: 300,
      is_founding_member: true,
      founding_member_locked_price_monthly: 15,
      founding_member_locked_price_yearly: 150,
      payment_claimed_at: null,
      forum_banned: false,
      alt_payment_note: ""
    }],
    booking_links: [{
      id: linkId,
      owner_id: ownerId,
      slug: "lensa-kreatif",
      label: "Lensa Kreatif Studio",
      is_primary: true,
      default_deposit_amount: 300,
      slot_duration_minutes: 120,
      booking_min_notice_hours: 24,
      buffer_minutes: 30,
      cancel_notice_hours: 48,
      description: "Studio fotografi perkahwinan, pra-perkahwinan, potret keluarga & liputan majlis rasmi. Tempah slot anda secara dalam talian dengan jaminan kepuasan.",
      poster_url: null,
      created_at: isoDateTime(daysFromNow(-90))
    }],
    event_types: [
      {
        id: etSanding,
        owner_id: ownerId,
        booking_link_id: linkId,
        name: "Pakej Sanding Signature (2 Sesi)",
        duration_minutes: 480,
        deposit_amount: 500,
        capacity: 1,
        sort_order: 0,
        description: "Liputan penuh hari majlis perkahwinan (Akad Nikah & Resepsi Sanding) bersama 2 jurugambar senior, pendrive eksklusif & album berbingkai kristal.",
        poster_url: "https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop&q=80"
      },
      {
        id: etPrewed,
        owner_id: ownerId,
        booking_link_id: linkId,
        name: "Pakej Pra-Perkahwinan Outdoor Cinematic",
        duration_minutes: 240,
        deposit_amount: 300,
        capacity: 1,
        sort_order: 1,
        description: "Sesi outdoor 2 lokasi pilihan, 40 gambar diedit resolusi penuh, termasuk khidmat jurusolek asas dan salinan digital tanpa tera air.",
        poster_url: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop&q=80"
      },
      {
        id: etPotret,
        owner_id: ownerId,
        booking_link_id: linkId,
        name: "Sesi Studio Potret Keluarga Eksklusif",
        duration_minutes: 90,
        deposit_amount: 150,
        capacity: 8,
        sort_order: 2,
        description: "Sesi santai keluarga di studio berhawa dingin (sehingga 8 orang). Percuma 1 cetakan kayu berbingkai 8R & fail digital tanpa had.",
        poster_url: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=800&auto=format&fit=crop&q=80"
      },
      {
        id: etKorporat,
        owner_id: ownerId,
        booking_link_id: linkId,
        name: "Liputan Majlis Korporat & Gala Dinner",
        duration_minutes: 300,
        deposit_amount: 500,
        capacity: 1,
        sort_order: 3,
        description: "Liputan rasmi majlis makan malam, perasmian atau seminar korporat. Penghantaran gambar ekspres dalam 24 jam untuk media sosial.",
        poster_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80"
      }
    ],
    availability_dates,
    booking_questions: [
      { id: "demo-lq1", owner_id: ownerId, booking_link_id: linkId, question_text: "Lokasi majlis atau lokasi photoshoot yang dikehendaki?", sort_order: 0 },
      { id: "demo-lq2", owner_id: ownerId, booking_link_id: linkId, question_text: "Tema pakaian atau konsep warna utama?", sort_order: 1 },
      { id: "demo-lq3", owner_id: ownerId, booking_link_id: linkId, question_text: "Bilangan tetamu atau bilangan ahli keluarga terlibat?", sort_order: 2 },
      { id: "demo-lq4", owner_id: ownerId, booking_link_id: linkId, question_text: "Adakah terdapat shot list atau permintaan khas?", sort_order: 3 }
    ],
    bookings,
    customers,
    notifications,
    chat_messages,
    chat_faq_templates,
    equipment,
    leads,
    expenses,
    testimonials,
    gallery_images,
    reminder_settings: [{ id: "demo-lrs-1", owner_id: ownerId, days_before: [3, 1, 0] }],
    note_templates: [
      { id: "demo-lnt-1", owner_id: ownerId, text: "Deposit disahkan. Baki dibayar mengikut jadual ansuran sebelum penyerahan album." }
    ],
    reminders_log: []
  };
}

// ─────────────────────────────────────────────────────────────
// NICHE 2: KATERING AISKRIM (Aiskrim Comel)
// ─────────────────────────────────────────────────────────────
function buildAiskrimComelDataset() {
  const ownerId = "demo-aiskrim-uid";
  const linkId = "demo-link-aiskrim";
  const et1 = "demo-et-mini", et2 = "demo-et-standard", et3 = "demo-et-premium";

  const availability_dates = [];
  for (let i = 0; i < 30; i++) {
    const day = daysFromNow(i);
    if (day.getDay() === 6 || day.getDay() === 0) {
      availability_dates.push({ id: `avail-${i}`, owner_id: ownerId, booking_link_id: linkId, specific_date: isoDate(day), start_time: "10:00:00", end_time: "18:00:00" });
    }
  }

  const bookings = [
    {
      id: "demo-bk-1", owner_id: ownerId, booking_link_id: linkId, event_type_id: et2,
      customer_name: "Nurul Iman", customer_email: "nurul.demo@example.com", customer_phone: "013-222 3344",
      slot_datetime: isoDateTime(nextWeekday(new Date(), 6)), duration_minutes: 180,
      status: "confirmed", deposit_amount: 200, deposit_paid: false,
      custom_answers: { "Berapa jumlah tetamu dijangka?": "80 orang", "Lokasi event (nyatakan kawasan)?": "Dewan Serbaguna, Shah Alam" },
      created_at: isoDateTime(daysFromNow(-2))
    },
    {
      id: "demo-bk-2", owner_id: ownerId, booking_link_id: linkId, event_type_id: et1,
      customer_name: "Ahmad Firdaus", customer_email: "firdaus.demo@example.com", customer_phone: "019-887 6655",
      slot_datetime: isoDateTime(daysFromNow(9)), duration_minutes: 120,
      status: "confirmed", deposit_amount: 100, deposit_paid: true,
      custom_answers: { "Berapa jumlah tetamu dijangka?": "40 orang", "Lokasi event (nyatakan kawasan)?": "Rumah, Taman Melawati" },
      created_at: isoDateTime(daysFromNow(-5))
    }
  ];

  const customers = bookings.map((b, i) => ({
    id: `demo-cust-${i + 1}`, booking_id: b.id, owner_id: ownerId, name: b.customer_name, contact_email: b.customer_email, email: b.customer_email, phone: b.customer_phone,
    amount: b.deposit_amount, status: b.deposit_paid ? "dah_bayar" : "belum_bayar",
    paid_at: b.deposit_paid ? isoDateTime(daysFromNow(-3)) : null,
    due_date: isoDate(daysFromNow(3)), notes: "", is_recurring: false, created_at: b.created_at
  }));

  return {
    user: { id: ownerId, email: "demo-aiskrim@eqstudio.link" },
    profiles: [{
      id: ownerId, business_name: "Aiskrim Comel", contact_phone: "012-345 6789", contact_email: "aiskrimcomel@example.com",
      business_address: "Shah Alam, Selangor", logo_url: null, brand_color: null,
      bank_name: "Maybank", bank_account_number: "1623 0045 9912", bank_account_holder: "Aiskrim Comel Enterprise",
      qr_code_url: null, ssm_number: "202301234567", tier: "pro", subscription_status: "active", subscription_end_date: isoDate(daysFromNow(300)),
      is_suspended: false, booking_slug: "aiskrim-comel", default_deposit_amount: 100,
      is_founding_member: true, founding_member_locked_price_monthly: 15, founding_member_locked_price_yearly: 150,
      payment_claimed_at: null, forum_banned: false, alt_payment_note: ""
    }],
    booking_links: [{
      id: linkId, owner_id: ownerId, slug: "aiskrim-comel", label: "Aiskrim Comel", is_primary: true,
      default_deposit_amount: 100, slot_duration_minutes: 120, booking_min_notice_hours: 24, buffer_minutes: 15,
      cancel_notice_hours: 24, description: "Katering aiskrim premium untuk majlis dan event korporat.",
      poster_url: null, created_at: isoDateTime(daysFromNow(-60))
    }],
    event_types: [
      { id: et1, owner_id: ownerId, booking_link_id: linkId, name: "Pakej Mini (40 org)", duration_minutes: 120, deposit_amount: 100, capacity: 1, sort_order: 0, description: "Sesuai untuk majlis kecil.", poster_url: null },
      { id: et2, owner_id: ownerId, booking_link_id: linkId, name: "Pakej Standard (80 org)", duration_minutes: 180, deposit_amount: 200, capacity: 1, sort_order: 1, description: "Pilihan popular untuk majlis rumah.", poster_url: null }
    ],
    availability_dates,
    booking_questions: [
      { id: "demo-q1", owner_id: ownerId, booking_link_id: linkId, question_text: "Berapa jumlah tetamu dijangka?", sort_order: 0 }
    ],
    bookings,
    customers,
    notifications: [],
    chat_messages: [],
    chat_faq_templates: [],
    equipment: [],
    leads: [],
    expenses: [],
    testimonials: [],
    gallery_images: [],
    reminder_settings: [{ id: "demo-rs-1", owner_id: ownerId, days_before: [3, 1, 0] }],
    note_templates: [],
    reminders_log: []
  };
}


// ─────────────────────────────────────────────────────────────
// NICHE 3: MAKEUP ARTIST & JURUSOLEK PENGANTIN (Bella Glam Studio)
// ─────────────────────────────────────────────────────────────
function buildMuaDataset() {
  const ownerId = "demo-mua-uid";
  const linkId = "demo-link-mua";
  const etNikah = "demo-et-mua-nikah";
  const etSanding = "demo-et-mua-sanding";
  const etFull = "demo-et-mua-full";
  const etEvent = "demo-et-mua-event";

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const availability_dates = [];
  for (let i = 0; i < 60; i++) {
    const day = daysFromNow(i);
    const dow = day.getDay();
    if (dow === 4 || dow === 5 || dow === 6 || dow === 0) {
      availability_dates.push({
        id: `avail-mua-${i}`,
        owner_id: ownerId,
        booking_link_id: linkId,
        specific_date: isoDate(day),
        start_time: "05:00:00",
        end_time: "18:00:00"
      });
    }
  }

  const bookings = [];
  let bkIdx = 1;

  const pastList = [
    { daysAgo: 13, name: "Farhana & Haziq", et: etSanding, fee: 650, time: 11 },
    { daysAgo: 12, name: "Nurul Aini (Nikah)", et: etNikah, fee: 450, time: 5 },
    { daysAgo: 11, name: "Datin Seri Rosnah (Dinner)", et: etEvent, fee: 200, time: 17 },
    { daysAgo: 10, name: "Siti Sarah & Azlan", et: etFull, fee: 1100, time: 6 },
    { daysAgo: 9,  name: "Natasha (Tunang)", et: etNikah, fee: 450, time: 10 },
    { daysAgo: 8,  name: "Anis & Hafiz", et: etSanding, fee: 650, time: 11 },
    { daysAgo: 7,  name: "Dr. Liyana (Gala Dinner)", et: etEvent, fee: 200, time: 16 },
    { daysAgo: 6,  name: "Nabila & Syakir", et: etFull, fee: 1100, time: 5 },
    { daysAgo: 5,  name: "Puteri Balqis", et: etNikah, fee: 450, time: 6 },
    { daysAgo: 4,  name: "Aisyah & Danial", et: etSanding, fee: 650, time: 11 },
    { daysAgo: 3,  name: "Fatin Nadia (Dinner)", et: etEvent, fee: 200, time: 17 },
    { daysAgo: 2,  name: "Zulaikha & Khairul", et: etFull, fee: 1100, time: 5 },
    { daysAgo: 2,  name: "Amira (Pre-Wed Shoot)", et: etEvent, fee: 200, time: 14 },
    { daysAgo: 1,  name: "Syaza (Nikah Subuh)", et: etNikah, fee: 450, time: 5 },
    { daysAgo: 1,  name: "Irdina & Faris", et: etSanding, fee: 650, time: 11 },
    { daysAgo: 0,  name: "Melissa (Sanding Petang)", et: etSanding, fee: 650, time: 12 }
  ];

  for (const p of pastList) {
    const slotD = daysFromNow(-p.daysAgo);
    slotD.setHours(p.time, 0, 0, 0);
    bookings.push({
      id: `demo-mbk-${bkIdx}`,
      owner_id: ownerId,
      booking_link_id: linkId,
      event_type_id: p.et,
      customer_id: `demo-mcust-${bkIdx}`,
      customer_name: p.name,
      customer_email: `bride${bkIdx}@example.com`,
      customer_phone: `013-${String(200 + bkIdx * 17).slice(0, 3)} ${String(1000 + bkIdx * 31).slice(0, 4)}`,
      slot_datetime: isoDateTime(slotD),
      duration_minutes: p.et === etFull ? 300 : (p.et === etSanding ? 150 : 120),
      status: "confirmed",
      deposit_amount: p.fee > 600 ? 300 : 150,
      deposit_paid: true,
      custom_answers: {
        "Lokasi tempat bersiap (nyatakan alamat rumah, nama hotel atau dewan)?": "Hotel Le Meridien Putrajaya",
        "Pukul berapa mekap WAJIB siap sepenuhnya?": "7:00 AM",
        "Jenis kulit dan adakah mempunyai sebarang alahan kosmetik?": "Kulit kombinasi normal-kering, tiada alahan",
        "Pilihan rujukan gaya mekap (cth: Soft Glam, Natural Barbie, Thai Look)?": "Soft Barbie Glowing Look"
      },
      created_at: isoDateTime(daysFromNow(-p.daysAgo - 4))
    });
    bkIdx++;
  }

  const upcomingList = [
    { daysAhead: 1, time: 5, name: "Nurul Huda (Nikah)", et: etNikah, loc: "Masjid Wilayah KL" },
    { daysAhead: 2, time: 11, name: "Iffah & Luqman (Sanding)", et: etSanding, loc: "Dewan Seri Siantan" },
    { daysAhead: 3, time: 5, name: "Sharifah Diana (Nikah)", et: etNikah, loc: "Hotel Majestic KL" },
    { daysAhead: 4, time: 17, name: "Datin Azura (Dinner)", et: etEvent, loc: "Grand Hyatt KL" },
    { daysAhead: 5, time: 5, name: "Athirah & Hafiz (Full 2 Sesi)", et: etFull, loc: "Glasshouse Seputeh" },
    { daysAhead: 7, time: 11, name: "Zulaikha (Sanding)", et: etSanding, loc: "Boraombak Marina" },
    { daysAhead: 8, time: 5, name: "Farah Adila (Nikah Subuh)", et: etNikah, loc: "Rumah Pengantin, Shah Alam" },
    { daysAhead: 9, time: 12, name: "Nurin (Sanding)", et: etSanding, loc: "Dewan Perdana Felda" },
    { daysAhead: 11, time: 5, name: "Maisarah & Syafiq (Nikah)", et: etNikah, loc: "Masjid Tuanku Mizan Putrajaya" },
    { daysAhead: 12, time: 11, name: "Tengku Nadia (Sanding)", et: etSanding, loc: "Royale Chulan Damansara" },
    { daysAhead: 14, time: 16, name: "Siti Khatijah (Konvo)", et: etEvent, loc: "Studio Bella Glam" },
    { daysAhead: 15, time: 5, name: "Wan Nurul (Nikah Subuh)", et: etNikah, loc: "Hotel Istana KL" },
    { daysAhead: 18, time: 11, name: "Hanis & Zikri (Sanding)", et: etSanding, loc: "Dewan Seri Endon" },
    { daysAhead: 20, time: 5, name: "Sarah & Norman (2 Sesi)", et: etFull, loc: "Magica Subang" },
    { daysAhead: 22, time: 11, name: "Ainul Mardhiah", et: etSanding, loc: "Dewan Sivik MBPJ" },
    { daysAhead: 25, time: 5, name: "Qistina (Nikah)", et: etNikah, loc: "Masjid Shah Alam" },
    { daysAhead: 27, time: 11, name: "Diana & Adam (Sanding)", et: etSanding, loc: "Hilton Petaling Jaya" },
    { daysAhead: 29, time: 5, name: "Sabrina (Nikah Subuh)", et: etNikah, loc: "Cyberview Resort" },
    { daysAhead: 32, time: 11, name: "Alia & Zharif (Sanding)", et: etSanding, loc: "Lakeside Terrace Cyberjaya" },
    { daysAhead: 35, time: 5, name: "Fatin (Nikah)", et: etNikah, loc: "Masjid Wilayah" },
    { daysAhead: 38, time: 11, name: "Nabila (Sanding)", et: etSanding, loc: "Mandarin Oriental" },
    { daysAhead: 42, time: 5, name: "Syakirah (Nikah)", et: etNikah, loc: "Dewan Banquet Menara Felda" }
  ];

  for (const uc of upcomingList) {
    const slotD = daysFromNow(uc.daysAhead);
    slotD.setHours(uc.time, 0, 0, 0);
    bookings.push({
      id: `demo-mbk-${bkIdx}`,
      owner_id: ownerId,
      booking_link_id: linkId,
      event_type_id: uc.et,
      customer_id: `demo-mcust-${bkIdx}`,
      customer_name: uc.name,
      customer_email: `bride${bkIdx}@example.com`,
      customer_phone: `012-${String(300 + bkIdx * 19).slice(0, 3)} ${String(2000 + bkIdx * 29).slice(0, 4)}`,
      slot_datetime: isoDateTime(slotD),
      duration_minutes: uc.et === etFull ? 300 : (uc.et === etSanding ? 150 : 120),
      status: "confirmed",
      deposit_amount: uc.et === etFull ? 350 : 200,
      deposit_paid: true,
      custom_answers: {
        "Lokasi tempat bersiap (nyatakan alamat rumah, nama hotel atau dewan)?": uc.loc,
        "Pukul berapa mekap WAJIB siap sepenuhnya?": `${uc.time + 2}:00`,
        "Jenis kulit dan adakah mempunyai sebarang alahan kosmetik?": "Kulit normal, minta bulu mata selesa",
        "Pilihan rujukan gaya mekap (cth: Soft Glam, Natural Barbie, Thai Look)?": "Soft Glam / Thai Look"
      },
      created_at: isoDateTime(daysFromNow(-2))
    });
    bkIdx++;
  }

  const customers = [];
  let custId = 1;

  const thisMonthPaid = [
    { name: "Farhana & Haziq (Pakej Sanding)", amount: 650, phone: "013-221 4455", daysAgo: 8, bId: "demo-mbk-1" },
    { name: "Siti Sarah & Azlan (2 Sesi Lengkap)", amount: 1100, phone: "017-889 0011", daysAgo: 10, bId: "demo-mbk-4" },
    { name: "Anis & Hafiz (Mekap Sanding)", amount: 650, phone: "019-334 5566", daysAgo: 8, bId: "demo-mbk-6" },
    { name: "Nabila & Syakir (Nikah & Sanding)", amount: 1100, phone: "012-778 9900", daysAgo: 6, bId: "demo-mbk-8" },
    { name: "Zulaikha & Khairul (2 Sesi)", amount: 1100, phone: "016-554 2233", daysAgo: 2, bId: "demo-mbk-12" },
    { name: "Irdina & Faris (Sanding)", amount: 650, phone: "018-990 1122", daysAgo: 1, bId: "demo-mbk-15" },
    { name: "Nurul Aini (Nikah Subuh)", amount: 450, phone: "011-234 5678", daysAgo: 12, bId: "demo-mbk-2" },
    { name: "Natasha (Mekap Tunang)", amount: 450, phone: "014-556 7890", daysAgo: 9, bId: "demo-mbk-5" },
    { name: "Puteri Balqis (Mekap Nikah)", amount: 450, phone: "019-887 6655", daysAgo: 5, bId: "demo-mbk-9" },
    { name: "Aisyah & Danial (Mekap Sanding)", amount: 650, phone: "013-112 3344", daysAgo: 4, bId: "demo-mbk-10" },
    { name: "Syaza (Nikah Subuh)", amount: 450, phone: "012-445 6678", daysAgo: 1, bId: "demo-mbk-14" },
    { name: "Melissa (Sanding Petang)", amount: 650, phone: "017-665 4433", daysAgo: 0, bId: "demo-mbk-16" }
  ];

  for (const p of thisMonthPaid) {
    const pDate = daysFromNow(-p.daysAgo);
    const pIso = `${thisMonthKey}-${String(pDate.getDate()).padStart(2, "0")}T10:00:00.000Z`;
    customers.push({
      id: `demo-mcust-${custId}`,
      owner_id: ownerId,
      booking_id: p.bId,
      name: p.name,
      contact_email: `client${custId}@example.com`,
      email: `client${custId}@example.com`,
      phone: p.phone,
      contact_phone: p.phone,
      amount: p.amount,
      status: "dah_bayar",
      paid_at: pIso,
      due_date: pIso.slice(0, 10),
      milestone_label: "Bayaran Penuh Pakej",
      notes: "Bayaran DuitNow disahkan",
      is_recurring: false,
      created_at: pIso
    });
    custId++;
  }

  const unpaid = [
    { name: "Nurul Huda (Baki Majlis Nikah)", amount: 300, daysAhead: 1, phone: "013-445 6677", status: "belum_bayar" },
    { name: "Iffah & Luqman (Baki Sanding)", amount: 450, daysAhead: 2, phone: "019-223 4455", status: "reminder_dihantar" },
    { name: "Sharifah Diana (Baki Nikah)", amount: 300, daysAhead: 3, phone: "012-887 6655", status: "belum_bayar" },
    { name: "Athirah & Hafiz (Baki 2 Sesi)", amount: 750, daysAhead: 5, phone: "018-778 9901", status: "reminder_dihantar" },
    { name: "Zulaikha (Baki Sanding Marina)", amount: 450, daysAhead: 7, phone: "017-334 5566", status: "belum_bayar" },
    { name: "Nurin (Baki Sanding Felda)", amount: 450, daysAhead: 9, phone: "016-778 2211", status: "belum_bayar" }
  ];
  for (const u of unpaid) {
    const dDate = daysFromNow(u.daysAhead);
    customers.push({
      id: `demo-mcust-${custId}`,
      owner_id: ownerId,
      booking_id: `demo-mbk-${custId}`,
      name: u.name,
      contact_email: `client${custId}@example.com`,
      email: `client${custId}@example.com`,
      phone: u.phone,
      contact_phone: u.phone,
      amount: u.amount,
      status: u.status,
      paid_at: null,
      due_date: isoDate(dDate),
      milestone_label: "Baki Hari Majlis",
      notes: "Menunggu baki sebelum majlis",
      is_recurring: false,
      created_at: isoDateTime(daysFromNow(-3))
    });
    custId++;
  }

  const needed = 380 - (custId - 1);
  for (let i = 0; i < needed; i++) {
    const pastDays = 35 + i * 2;
    const pDate = daysFromNow(-pastDays);
    customers.push({
      id: `demo-mcust-${custId}`,
      owner_id: ownerId,
      booking_id: null,
      name: `Pengantin Anggun #${380 - i}`,
      contact_email: `client${custId}@example.com`,
      email: `client${custId}@example.com`,
      phone: `012-${String(100 + i % 899)} ${String(1000 + i % 8999)}`,
      contact_phone: `012-${String(100 + i % 899)} ${String(1000 + i % 8999)}`,
      amount: 450 + (i % 4) * 200,
      status: "dah_bayar",
      paid_at: isoDateTime(pDate),
      due_date: isoDate(pDate),
      milestone_label: "Bayaran Penuh",
      notes: "Selesai",
      is_recurring: false,
      created_at: isoDateTime(pDate)
    });
    custId++;
  }

  const notifications = [
    { id: "mnotif-1", owner_id: ownerId, type: "new_booking", title: "Tempahan Baharu Masuk", message: "Nurul Huda menempah Pakej Nikah Subuh (Masjid Wilayah KL)", link_url: "/dashboard.html?page=booking-list", is_read: false, created_at: isoDateTime(daysFromNow(0)) },
    { id: "mnotif-2", owner_id: ownerId, type: "deposit_paid", title: "Deposit DuitNow RM200 Diterima", message: "Iffah & Luqman telah membayar deposit untuk Pakej Sanding", link_url: "/dashboard.html?page=customer-list", is_read: false, created_at: isoDateTime(daysFromNow(-1)) },
    { id: "mnotif-3", owner_id: ownerId, type: "prep_reminder", title: "Peringatan Persediaan Kulit Dihantar", message: "Automasi WhatsApp tips penjagaan kulit dihantar kepada 3 pengantin minggu ini", link_url: "/dashboard.html?page=customer-list", is_read: true, created_at: isoDateTime(daysFromNow(-2)) },
    { id: "mnotif-4", owner_id: ownerId, type: "review", title: "Ulasan 5 Bintang Diterima", message: "Farhana: 'Mekap tahan lebih 14 jam dari nikah sampai sanding! Ramai puji berseri.'", link_url: "/dashboard.html?page=booking-settings", is_read: true, created_at: isoDateTime(daysFromNow(-4)) }
  ];

  const chat_messages = [
    { id: "mmsg-1", customer_id: "demo-mcust-1", sender_type: "customer", message_text: "Salam Kak Bella! Nak tanya untuk mekap sanding ahad ni, kening perlu cukur ke?", created_at: isoDateTime(daysFromNow(-2)), read_by_owner: true },
    { id: "mmsg-2", customer_id: "demo-mcust-1", sender_type: "owner", message_text: "Waalaikumussalam Farhana! Tak perlu cukur ya sayang, akak guna teknik brow concealer untuk kemaskan bentuk kening tanpa cukur.", created_at: isoDateTime(daysFromNow(-1)), read_by_owner: true },
    { id: "mmsg-3", customer_id: "demo-mcust-1", sender_type: "customer", message_text: "Alhamdulillah lega dengar! Jumpa akak pukul 5:30 pagi ahad ni kat bilik hotel ya.", created_at: isoDateTime(daysFromNow(0)), read_by_owner: false },
    { id: "mmsg-4", customer_id: "demo-mcust-13", sender_type: "customer", message_text: "Hi Kak Bella, saya dah transfer baki mekap RM300 ikut link tadi. Ni resit Maybank.", created_at: isoDateTime(daysFromNow(-1)), read_by_owner: true },
    { id: "mmsg-5", customer_id: "demo-mcust-13", sender_type: "owner", message_text: "Terima kasih Huda! Resit dah disahkan dalam sistem. Rehat cukup-cukup malam ni ya.", created_at: isoDateTime(daysFromNow(-1)), read_by_owner: true }
  ];

  const equipment = [
    { id: "meq-1", owner_id: ownerId, name: "Professional Rolling Makeup Train Case", category: "Makeup Case", status: "Tersedia", location: "Car Trunk / Studio" },
    { id: "meq-2", owner_id: ownerId, name: "Neewer 18-inch Bi-Color LED Ring Light", category: "Lighting", status: "Tersedia", location: "Studio Bay" },
    { id: "meq-3", owner_id: ownerId, name: "TEMPTU Pro Cordless Airbrush Gun", category: "Airbrush", status: "Tersedia", location: "Case A" },
    { id: "meq-4", owner_id: ownerId, name: "Foldable High Director's Makeup Chair", category: "Furniture", status: "Tersedia", location: "Car Trunk" },
    { id: "meq-5", owner_id: ownerId, name: "Dyson Supersonic Hair Dryer Pro", category: "Hair Styling", status: "Tersedia", location: "Hair Case" }
  ];

  const testimonials = [
    { id: "mt-1", owner_id: ownerId, customer_name: "Farhana & Haziq", quote_text: "Mekap Kak Bella memang tahan lasak dari Subuh sampai ke malam! Tak bercapuk langsung walaupun berpeluh masa sesi photoshoot outdoor.", sort_order: 0 },
    { id: "mt-2", owner_id: ownerId, customer_name: "Siti Sarah & Azlan", quote_text: "Sangat profesional. Kak Bella datang on-time pukul 5 pagi dan siap tepat waktu sebelum rombongan lelaki sampai.", sort_order: 1 }
  ];

  const gallery_images = [
    { id: "mgal-1", owner_id: ownerId, image_url: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&auto=format&fit=crop&q=80", sort_order: 0 },
    { id: "mgal-2", owner_id: ownerId, image_url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop&q=80", sort_order: 1 },
    { id: "mgal-3", owner_id: ownerId, image_url: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&auto=format&fit=crop&q=80", sort_order: 2 }
  ];

  return {
    user: { id: ownerId, email: "demo-mua@eqstudio.link" },
    profiles: [{
      id: ownerId,
      business_name: "Bella Glam MUA & Bridal Studio",
      contact_phone: "013-667 8899",
      contact_email: "bellaglam@eqstudio.link",
      business_address: "Subang Jaya, Selangor",
      logo_url: null,
      brand_color: "#C2410C",
      bank_name: "Maybank",
      bank_account_number: "5123 4567 8901",
      bank_account_holder: "Bella Glam Enterprise",
      qr_code_url: null,
      ssm_number: "202401887766",
      tier: "pro",
      subscription_status: "active",
      subscription_end_date: isoDate(daysFromNow(365)),
      is_suspended: false,
      booking_slug: "bella-glam",
      default_deposit_amount: 200,
      is_founding_member: true,
      founding_member_locked_price_monthly: 15,
      founding_member_locked_price_yearly: 150,
      payment_claimed_at: null,
      forum_banned: false,
      alt_payment_note: ""
    }],
    booking_links: [{
      id: linkId,
      owner_id: ownerId,
      slug: "bella-glam",
      label: "Bella Glam MUA Studio",
      is_primary: true,
      default_deposit_amount: 200,
      slot_duration_minutes: 150,
      booking_min_notice_hours: 24,
      buffer_minutes: 60,
      cancel_notice_hours: 48,
      description: "Servis solekan profesional untuk pengantin Nikah, Sanding, Bertunang & Majlis Rasmi. Sentuhan eksklusif bertaraf selebriti.",
      poster_url: null,
      created_at: isoDateTime(daysFromNow(-90))
    }],
    event_types: [
      { id: etNikah, owner_id: ownerId, booking_link_id: linkId, name: "Pakej Mekap Nikah & Tunang", duration_minutes: 120, deposit_amount: 150, capacity: 1, sort_order: 0, description: "Solekan lembut & berseri untuk upacara akad nikah atau pertunangan. Termasuk bulu mata premium dan pelembap asas.", poster_url: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&auto=format&fit=crop&q=80" },
      { id: etSanding, owner_id: ownerId, booking_link_id: linkId, name: "Pakej Mekap Sanding Signature", duration_minutes: 150, deposit_amount: 200, capacity: 1, sort_order: 1, description: "Solekan eksklusif tahan lebih 12 jam untuk majlis resepsi pelamin. Termasuk pemakaian aksesori kepala & veil.", poster_url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop&q=80" },
      { id: etFull, owner_id: ownerId, booking_link_id: linkId, name: "Pakej 2 Sesi: Nikah & Sanding Lengkap", duration_minutes: 300, deposit_amount: 350, capacity: 1, sort_order: 2, description: "Pakej lengkap 2 sesi berasingan pada hari sama atau hari berbeza. Jimat RM200 dan percuma touch-up sebelum naik pelamin.", poster_url: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&auto=format&fit=crop&q=80" },
      { id: etEvent, owner_id: ownerId, booking_link_id: linkId, name: "Mekap Majlis Makan Malam & Konvo", duration_minutes: 60, deposit_amount: 80, capacity: 1, sort_order: 3, description: "Solekan majlis makan malam korporat, sesi konvokesyen atau mekap bridesmaid/ibu pengantin.", poster_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80" }
    ],
    availability_dates,
    booking_questions: [
      { id: "mq-1", owner_id: ownerId, booking_link_id: linkId, question_text: "Lokasi tempat bersiap (nyatakan alamat rumah, nama hotel atau dewan)?", sort_order: 0 },
      { id: "mq-2", owner_id: ownerId, booking_link_id: linkId, question_text: "Pukul berapa mekap WAJIB siap sepenuhnya?", sort_order: 1 },
      { id: "mq-3", owner_id: ownerId, booking_link_id: linkId, question_text: "Jenis kulit dan adakah mempunyai sebarang alahan kosmetik?", sort_order: 2 },
      { id: "mq-4", owner_id: ownerId, booking_link_id: linkId, question_text: "Pilihan rujukan gaya mekap (cth: Soft Glam, Natural Barbie, Thai Look)?", sort_order: 3 }
    ],
    bookings,
    customers,
    notifications,
    chat_messages,
    chat_faq_templates: [
      { id: "mfaq-1", owner_id: ownerId, title: "Cara Kunci Tarikh", text: "Deposit diperlukan untuk mengunci slot masa rasmi. Pindahan DuitNow QR akan disahkan serta-merta." },
      { id: "mfaq-2", owner_id: ownerId, title: "Persediaan Sebelum Mekap", text: "Sila bersihkan muka dan pakai hydrating sheet mask malam sebelum majlis. Elakkan waxing kening 24 jam sebelum sesi." }
    ],
    equipment,
    leads: [
      { id: "mlead-1", owner_id: ownerId, name: "Tengku Nadia", phone: "012-887 6655", email: "nadia@example.com", package_name: "Pakej 2 Sesi Sanding & Nikah (RM1,100)", status: "Berminat", notes: "Majlis di Royale Chulan Disember.", created_at: isoDateTime(daysFromNow(-2)) },
      { id: "mlead-2", owner_id: ownerId, name: "Ainul Mardhiah", phone: "013-445 7788", email: "ainul@example.com", package_name: "Pakej Sanding Signature", status: "Dihubungi", notes: "Tanya pasal travel fee ke Rawang.", created_at: isoDateTime(daysFromNow(-3)) }
    ],
    expenses: [
      { id: "mexp-1", owner_id: ownerId, title: "Restock Skincare & Kosmetik Premium (Sephora)", amount: 850, category: "Kos Produk", expense_date: isoDate(daysFromNow(-4)) },
      { id: "mexp-2", owner_id: ownerId, title: "Minyak Kenderaan & Tol Majlis Hujung Minggu", amount: 160, category: "Pengangkutan", expense_date: isoDate(daysFromNow(-6)) }
    ],
    testimonials,
    gallery_images,
    reminder_settings: [{ id: "mrs-1", owner_id: ownerId, days_before: [3, 1, 0] }],
    note_templates: [{ id: "mnt-1", owner_id: ownerId, text: "Deposit disahkan. Baki dibayar sebelum majlis bermula." }],
    reminders_log: []
  };
}

const DEMO_DATASETS = {
  fotografi: buildLensaKreatifDataset(),
  mua: buildMuaDataset(),
  aiskrim: buildAiskrimComelDataset()
};

// ─────────────────────────────────────────────────────────────
// GENERIC QUERY BUILDER ENGINE (Supabase JS SDK replica)
// ─────────────────────────────────────────────────────────────
function createQueryBuilder(dataStore, tableName) {
  let rows = [...(dataStore[tableName] || [])];

  // Auto-join relations if needed
  if (tableName === "chat_messages") {
    rows = rows.map(r => ({
      ...r,
      customers: (dataStore.customers || []).find(c => c.id === r.customer_id) || {}
    }));
  }

  let filters = [];
  let sortSpec = null;
  let limitN = null;
  let wantSingle = false;
  let wantCount = false;
  let pendingOp = null;

  function applyFilters(arr) {
    return arr.filter(row => filters.every(([op, col, val]) => {
      if (op === "eq") return row[col] === val;
      if (op === "neq") return row[col] !== val;
      if (op === "gte") return row[col] >= val;
      if (op === "lte") return row[col] <= val;
      if (op === "in") return Array.isArray(val) ? val.includes(row[col]) : false;
      if (op === "not") {
        if (val === null || val === "null" || val === undefined) {
          return row[col] != null;
        }
        return row[col] !== val;
      }
      return true;
    }));
  }

  const builder = {
    select(_cols, opts) { if (opts?.count) wantCount = true; return builder; },
    eq(col, val) { filters.push(["eq", col, val]); return builder; },
    neq(col, val) { filters.push(["neq", col, val]); return builder; },
    gte(col, val) { filters.push(["gte", col, val]); return builder; },
    lte(col, val) { filters.push(["lte", col, val]); return builder; },
    in(col, vals) { filters.push(["in", col, Array.isArray(vals) ? vals : []]); return builder; },
    is(col, val) {
      if (val === null || val === "null") {
        filters.push(["eq", col, null]);
      } else {
        filters.push(["eq", col, val]);
      }
      return builder;
    },
    not(col, op, val) {
      if (op === "is" && (val === null || val === "null")) {
        filters.push(["not", col, null]);
      } else {
        filters.push(["not", col, val]);
      }
      return builder;
    },
    order(col, opts) { sortSpec = { col, ascending: opts?.ascending !== false }; return builder; },
    limit(n) { limitN = n; return builder; },
    single() { wantSingle = true; return builder; },
    maybeSingle() { wantSingle = true; return builder; },
    insert(payload) {
      pendingOp = { type: "insert", payload: Array.isArray(payload) ? payload : [payload] };
      return builder;
    },
    upsert(payload) {
      pendingOp = { type: "upsert", payload: Array.isArray(payload) ? payload : [payload] };
      return builder;
    },
    update(payload) {
      pendingOp = { type: "update", payload };
      return builder;
    },
    delete() {
      pendingOp = { type: "delete" };
      return builder;
    },
    then(resolve) {
      let result = applyFilters(rows);

      if (pendingOp?.type === "insert") {
        const inserted = pendingOp.payload.map(p => ({
          id: `demo-new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          created_at: new Date().toISOString(),
          ...p
        }));
        dataStore[tableName] = [...(dataStore[tableName] || []), ...inserted];
        return resolve({ data: wantSingle ? inserted[0] : inserted, error: null });
      }
      if (pendingOp?.type === "upsert") {
        const payloadList = pendingOp.payload;
        const currentRows = dataStore[tableName] || [];
        for (const item of payloadList) {
          const matchIdx = currentRows.findIndex(r => (item.id && r.id === item.id) || (item.owner_id && r.owner_id === item.owner_id));
          if (matchIdx >= 0) {
            currentRows[matchIdx] = { ...currentRows[matchIdx], ...item };
          } else {
            currentRows.push({ id: item.id || `demo-${Date.now()}`, created_at: new Date().toISOString(), ...item });
          }
        }
        dataStore[tableName] = currentRows;
        return resolve({ data: wantSingle ? payloadList[0] : payloadList, error: null });
      }
      if (pendingOp?.type === "update") {
        dataStore[tableName] = (dataStore[tableName] || []).map(row =>
          filters.every(([op, col, val]) => op === "eq" ? row[col] === val : true) ? { ...row, ...pendingOp.payload } : row
        );
        return resolve({ data: null, error: null });
      }
      if (pendingOp?.type === "delete") {
        dataStore[tableName] = (dataStore[tableName] || []).filter(row =>
          !filters.every(([op, col, val]) => op === "eq" ? row[col] === val : true)
        );
        return resolve({ data: null, error: null });
      }

      const fullCount = result.length;
      if (sortSpec) {
        result = [...result].sort((a, b) => {
          const av = a[sortSpec.col], bv = b[sortSpec.col];
          if (av === bv) return 0;
          const cmp = av > bv ? 1 : -1;
          return sortSpec.ascending ? cmp : -cmp;
        });
      }
      if (limitN != null) result = result.slice(0, limitN);

      if (wantSingle) return resolve({ data: result[0] || null, error: null, count: wantCount ? fullCount : undefined });
      return resolve({ data: result, error: null, count: wantCount ? fullCount : undefined });
    }
  };
  return builder;
}

export function createMockSupabaseClient(niche) {
  const selectedNiche = (niche === "mua" || niche === "aiskrim") ? niche : "fotografi";
  const dataStore = DEMO_DATASETS[selectedNiche] || DEMO_DATASETS.fotografi;
  const fakeSession = { access_token: "demo-token", user: dataStore.user };

  return {
    auth: {
      async getSession() { return { data: { session: fakeSession } }; },
      async getUser() { return { data: { user: dataStore.user } }; },
      async signOut() { window.location.href = (selectedNiche === "mua") ? "/mua.html" : "/fotografi.html"; },
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; }
    },
    from(tableName) { return createQueryBuilder(dataStore, tableName); },
    channel(_name) {
      const channelObj = {
        on(_event, _opts, _callback) { return channelObj; },
        subscribe(cb) {
          if (typeof cb === "function") cb("SUBSCRIBED");
          return channelObj;
        },
        unsubscribe() { return Promise.resolve(); }
      };
      return channelObj;
    },
    storage: {
      from() {
        return {
          async upload() { return { data: { path: "demo/fake.jpg" }, error: null }; },
          getPublicUrl() { return { data: { publicUrl: "" } }; }
        };
      }
    }
  };
}

export function isDemoModeActive() {
  const params = new URLSearchParams(window.location.search);
  return Boolean(params.get("demo"));
}

export function getDemoNiche() {
  const p = new URLSearchParams(window.location.search).get("demo");
  if (p === "mua") return "mua";
  if (p === "aiskrim") return "aiskrim";
  return "fotografi";
}
