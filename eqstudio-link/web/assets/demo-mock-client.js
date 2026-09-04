// demo-mock-client.js — powers Demo Mode (dashboard.html?demo=<niche>&key=<secret>).
// Provides a drop-in replacement for the real Supabase client so existing
// dashboard.html code (hundreds of .from().select().eq()... call sites)
// works completely UNCHANGED — it just reads/writes in-memory demo data
// instead of hitting the real database. No real Supabase calls are ever
// made in this mode, so there is no way for it to touch real user data.

// ── Date helpers — demo dates are generated RELATIVE to today, so the
// dataset never looks "stale" no matter when a video is recorded. ──
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

function buildAiskrimComelDataset() {
  const ownerId = "demo-aiskrim-uid";
  const linkId = "demo-link-aiskrim";
  const et1 = "demo-et-mini", et2 = "demo-et-standard", et3 = "demo-et-premium";

  // Availability: next 4 Saturdays and Sundays, each with an afternoon block
  const availability_dates = [];
  let cursor = new Date();
  for (let i = 0; i < 28; i++) {
    const day = daysFromNow(i);
    if (day.getDay() === 6 || day.getDay() === 0) { // Sat=6, Sun=0
      availability_dates.push({ id: `avail-${i}`, owner_id: ownerId, booking_link_id: linkId, specific_date: isoDate(day), start_time: "10:00:00", end_time: "18:00:00" });
    }
  }

  // A few upcoming bookings + a couple of past ones, spread across packages
  const upcomingSat = nextWeekday(new Date(), 6);
  const bookings = [
    {
      id: "demo-bk-1", owner_id: ownerId, booking_link_id: linkId, event_type_id: et2,
      customer_name: "Nurul Iman", customer_email: "nurul.demo@example.com", customer_phone: "013-222 3344",
      slot_datetime: isoDateTime(new Date(upcomingSat.getTime() + 12 * 3600 * 1000)), duration_minutes: 180,
      status: "confirmed", deposit_amount: 200, deposit_paid: false,
      custom_answers: { "Berapa jumlah tetamu dijangka?": "80 orang", "Lokasi event (nyatakan kawasan)?": "Dewan Serbaguna, Shah Alam", "Ada requirement perisa khas/alahan?": "Tiada, tapi minta perisa coklat & strawberi diutamakan" },
      created_at: isoDateTime(daysFromNow(-2)),
    },
    {
      id: "demo-bk-2", owner_id: ownerId, booking_link_id: linkId, event_type_id: et1,
      customer_name: "Ahmad Firdaus", customer_email: "firdaus.demo@example.com", customer_phone: "019-887 6655",
      slot_datetime: isoDateTime(new Date(daysFromNow(9).setHours(11, 0, 0, 0))), duration_minutes: 120,
      status: "confirmed", deposit_amount: 100, deposit_paid: true,
      custom_answers: { "Berapa jumlah tetamu dijangka?": "40 orang", "Lokasi event (nyatakan kawasan)?": "Rumah, Taman Melawati", "Ada requirement perisa khas/alahan?": "Alahan kacang" },
      created_at: isoDateTime(daysFromNow(-5)),
    },
    {
      id: "demo-bk-3", owner_id: ownerId, booking_link_id: linkId, event_type_id: et3,
      customer_name: "Siti Rahayu", customer_email: "siti.demo@example.com", customer_phone: "017-334 5566",
      slot_datetime: isoDateTime(new Date(daysFromNow(16).setHours(10, 0, 0, 0))), duration_minutes: 240,
      status: "confirmed", deposit_amount: 350, deposit_paid: false,
      custom_answers: { "Berapa jumlah tetamu dijangka?": "180 orang", "Lokasi event (nyatakan kawasan)?": "Hotel, Kuala Lumpur", "Ada requirement perisa khas/alahan?": "Tiada" },
      created_at: isoDateTime(daysFromNow(-1)),
    },
    {
      id: "demo-bk-4", owner_id: ownerId, booking_link_id: linkId, event_type_id: et2,
      customer_name: "Mohd Hafiz", customer_email: "hafiz.demo@example.com", customer_phone: "012-778 9900",
      slot_datetime: isoDateTime(daysFromNow(-10)), duration_minutes: 180,
      status: "completed", deposit_amount: 200, deposit_paid: true,
      custom_answers: { "Berapa jumlah tetamu dijangka?": "75 orang", "Lokasi event (nyatakan kawasan)?": "Sekolah, Petaling Jaya", "Ada requirement perisa khas/alahan?": "Tiada" },
      created_at: isoDateTime(daysFromNow(-15)),
    },
  ];

  const customers = bookings.map((b, i) => ({
    id: `demo-cust-${i + 1}`, owner_id: ownerId, name: b.customer_name, email: b.customer_email, phone: b.customer_phone,
    amount: b.deposit_amount, status: b.deposit_paid ? "dah_bayar" : "belum_bayar",
    due_date: isoDate(daysFromNow(3)), notes: "", is_recurring: false, created_at: b.created_at,
  }));

  return {
    user: { id: ownerId, email: "demo-aiskrim@eqstudio.link" },
    profile: {
      id: ownerId, business_name: "Aiskrim Comel", phone: "012-345 6789", email: "aiskrimcomel@example.com",
      address: "Shah Alam, Selangor", bank_name: "Maybank", bank_account: "1623 0045 9912", bank_holder: "Aiskrim Comel Enterprise",
      ssm_number: "202301234567", tier: "pro", subscription_status: "active", subscription_end_date: isoDate(daysFromNow(300)),
      is_founding_member: true, founding_member_locked_price_monthly: 15, founding_member_locked_price_yearly: 150,
      payment_claimed_at: null, is_suspended: false, forum_banned: false, alt_payment_note: "",
    },
    booking_links: [{
      id: linkId, owner_id: ownerId, slug: "aiskrim-comel", label: "Aiskrim Comel", is_primary: true,
      default_deposit_amount: 100, slot_duration_minutes: 120, booking_min_notice_hours: 24, buffer_minutes: 15,
      cancel_notice_hours: 24, description: "Katering aiskrim premium untuk majlis, kelas berenang, dan event korporat. Pelbagai perisa, servis di lokasi anda.",
      poster_url: null, created_at: isoDateTime(daysFromNow(-60)),
    }],
    event_types: [
      { id: et1, owner_id: ownerId, booking_link_id: linkId, name: "Pakej Mini (40 org)", duration_minutes: 120, deposit_amount: 100, capacity: 1, sort_order: 0, description: "Sesuai untuk majlis kecil atau kelas berenang. Termasuk 3 perisa pilihan dan peralatan lengkap.", poster_url: null },
      { id: et2, owner_id: ownerId, booking_link_id: linkId, name: "Pakej Standard (80 org)", duration_minutes: 180, deposit_amount: 200, capacity: 1, sort_order: 1, description: "Pilihan popular untuk majlis rumah dan event sekolah. Termasuk 5 perisa dan topping tambahan.", poster_url: null },
      { id: et3, owner_id: ownerId, booking_link_id: linkId, name: "Pakej Premium (150+ org)", duration_minutes: 240, deposit_amount: 350, capacity: 1, sort_order: 2, description: "Untuk event korporat dan majlis besar. Termasuk 8 perisa, topping premium, dan 2 orang kru servis.", poster_url: null },
    ],
    availability_dates,
    booking_questions: [
      { id: "demo-q1", owner_id: ownerId, booking_link_id: linkId, question_text: "Berapa jumlah tetamu dijangka?", sort_order: 0 },
      { id: "demo-q2", owner_id: ownerId, booking_link_id: linkId, question_text: "Lokasi event (nyatakan kawasan)?", sort_order: 1 },
      { id: "demo-q3", owner_id: ownerId, booking_link_id: linkId, question_text: "Ada requirement perisa khas/alahan?", sort_order: 2 },
    ],
    bookings,
    customers,
    notifications: [
      { id: "demo-notif-1", owner_id: ownerId, type: "new_booking", title: "Booking baharu diterima", message: "Siti Rahayu — Pakej Premium", link_url: "/dashboard.html?page=booking-list", is_read: false, created_at: isoDateTime(daysFromNow(-1)) },
      { id: "demo-notif-2", owner_id: ownerId, type: "new_booking", title: "Booking baharu diterima", message: "Nurul Iman — Pakej Standard", link_url: "/dashboard.html?page=booking-list", is_read: true, created_at: isoDateTime(daysFromNow(-2)) },
    ],
    reminder_settings: [{ id: "demo-rs-1", owner_id: ownerId, days_before: [3, 1, 0] }],
    note_templates: [
      { id: "demo-nt-1", owner_id: ownerId, text: "Deposit RM100 diterima, baki dibayar semasa hari acara." },
    ],
    reminders_log: [],
  };
}

const DEMO_DATASETS = {
  aiskrim: buildAiskrimComelDataset(),
};

// ── Generic mock query builder — mimics the chainable Supabase JS SDK API
// (.select/.eq/.order/.limit/.single/.insert/.update/.delete), backed by an
// in-memory array for whichever table name was passed to .from(). Works the
// same way regardless of table, so adding new demo niches to DEMO_DATASETS
// above never requires touching this builder logic. ──
function createQueryBuilder(dataStore, tableName) {
  let rows = [...(dataStore[tableName] || [])];
  let filters = [];
  let sortSpec = null;
  let limitN = null;
  let wantSingle = false;
  let wantCount = false;
  let pendingOp = null; // { type: "insert"|"update"|"delete", payload }

  function applyFilters(arr) {
    return arr.filter(row => filters.every(([op, col, val]) => {
      if (op === "eq") return row[col] === val;
      if (op === "neq") return row[col] !== val;
      if (op === "gte") return row[col] >= val;
      return true;
    }));
  }

  const builder = {
    select(_cols, opts) { if (opts?.count) wantCount = true; return builder; },
    eq(col, val) { filters.push(["eq", col, val]); return builder; },
    neq(col, val) { filters.push(["neq", col, val]); return builder; },
    gte(col, val) { filters.push(["gte", col, val]); return builder; },
    order(col, opts) { sortSpec = { col, ascending: opts?.ascending !== false }; return builder; },
    limit(n) { limitN = n; return builder; },
    single() { wantSingle = true; return builder; },
    insert(payload) {
      pendingOp = { type: "insert", payload: Array.isArray(payload) ? payload : [payload] };
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
        const inserted = pendingOp.payload.map(p => ({ id: `demo-new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, created_at: new Date().toISOString(), ...p }));
        dataStore[tableName] = [...(dataStore[tableName] || []), ...inserted];
        return resolve({ data: wantSingle ? inserted[0] : inserted, error: null });
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
    },
  };
  return builder;
}

export function createMockSupabaseClient(niche) {
  const dataStore = DEMO_DATASETS[niche] || DEMO_DATASETS.aiskrim;
  const fakeSession = { access_token: "demo-token", user: dataStore.user };

  return {
    auth: {
      async getSession() { return { data: { session: fakeSession } }; },
      async getUser() { return { data: { user: dataStore.user } }; },
      async signOut() { window.location.href = "/demo.html"; },
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } } }, // no-op in demo mode
    },
    from(tableName) { return createQueryBuilder(dataStore, tableName); },
    storage: {
      from() {
        return {
          async upload() { return { data: { path: "demo/fake.jpg" }, error: null }; },
          getPublicUrl() { return { data: { publicUrl: "" } }; },
        };
      },
    },
  };
}

export function isDemoModeActive() {
  const params = new URLSearchParams(window.location.search);
  return params.get("demo") && params.get("key") === "eqstudio-demo-2026";
}

export function getDemoNiche() {
  return new URLSearchParams(window.location.search).get("demo");
}
