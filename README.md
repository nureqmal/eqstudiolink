# eqstudio.link — Fasa 1 MVP

Automation reminder bayaran untuk business owner solo/kecil. Stack: Cloudflare
Pages (frontend + admin API) + Supabase (DB/Auth) + Cloudflare Worker Cron
(scheduled reminder) + Resend (email).

## Struktur folder

```
eqstudio-link/
├── supabase/
│   └── schema.sql          ← jalankan sekali dalam Supabase SQL Editor
├── functions/api/           ← KENA sebelah folder web/ (bukan dalam dia),
│   └── admin-stats.js         Cloudflare Pages Functions punya requirement
├── web/                     ← deploy folder ini ke Cloudflare Pages
│   ├── index.html             (landing page marketing — root domain)
│   ├── login.html              (log masuk / daftar)
│   ├── dashboard.html           (customer form + list + reminder settings)
│   ├── admin.html                 (founder-only stats page)
│   └── assets/
│       ├── config.js            ← ISI Supabase URL & anon key di sini
│       ├── supabase-client.js
│       └── style.css
└── worker-cron/              ← deploy ini secara berasingan sebagai Worker
    ├── src/index.js            (logic hantar reminder harian)
    ├── wrangler.toml
    └── package.json
```

**Deploy command (dari root folder `eqstudio-link/`):**
```
npx wrangler pages deploy web --project-name=eqstudio-link
```
Wrangler auto-detect `functions/` sebab dia sebelah `web/`. Kalau `functions/` tersalah letak *dalam* `web/functions/`, Pages Functions tak akan dikesan — tanda dia: output deploy takde baris "Compiled Worker successfully" / "Uploading Functions bundle".

## Setup — langkah demi langkah

### 1. Supabase
1. Buat project baru di supabase.com (free tier).
2. Buka **SQL Editor** → paste seluruh kandungan `supabase/schema.sql` → Run.
3. Buka **Project Settings > API** → salin `Project URL` dan `anon public` key.
4. Buka **Project Settings > API** → salin juga `service_role` key (untuk admin + cron — JANGAN letak ni dalam frontend code, hanya dalam secrets/env server-side).
5. (Selepas anda sendiri sign up kali pertama melalui app) jalankan di SQL Editor:
   ```sql
   update public.profiles set is_admin = true where id = '<uuid akaun anda>';
   ```
   (is_admin belum digunakan untuk enforce apa-apa di Fasa 1 — admin access dikawal oleh ADMIN_DASHBOARD_KEY, bukan flag ni. Flag ni sedia untuk Fasa 2 kalau nak lock admin.html kepada akaun tertentu je.)

### 2. Frontend (`web/`)
1. Edit `web/assets/config.js` — isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY`.
2. Push folder `web/` ke satu GitHub repo (atau upload direct).
3. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → connect repo, set **root directory** = `web`, build command kosong (static site).
4. Selepas deploy, pergi **Settings > Environment variables** untuk Pages project ini, tambah (untuk Production):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_DASHBOARD_KEY` (rekaan anda sendiri, contoh password panjang — ini yang anda taip di admin.html)
5. Redeploy supaya env vars tu aktif untuk Pages Function.

### 3. Cron Worker (`worker-cron/`)
1. `cd worker-cron && npm install`
2. `npx wrangler login`
3. Set secrets:
   ```
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put RESEND_FROM_EMAIL
   npx wrangler secret put MANUAL_TRIGGER_KEY
   ```
4. `npx wrangler deploy`
5. Worker akan jalan automatik setiap hari ikut `crons` dalam `wrangler.toml` (default 9am waktu Malaysia).
6. Untuk test manual sebelum tunggu esok: buka
   `https://<worker-url>.workers.dev/?key=<MANUAL_TRIGGER_KEY>` dalam browser.

### 4. Resend
1. Daftar di resend.com (free tier, 3,000 email/bulan).
2. Verify domain eqstudio.link (atau guna default `onboarding@resend.dev` untuk testing awal).
3. Salin API key untuk `RESEND_API_KEY` di atas.

## Nota Fasa 1
- Telegram automation **belum** diimplement (deferred) — reminder guna email je buat masa ini.
- Admin dashboard dikunci dengan satu shared password (`ADMIN_DASHBOARD_KEY`), bukan akaun berasingan — cukup untuk solo founder di fasa ni.
- Payment collection (Billplz/ToyyibPay) belum ada — Fasa 3.
- Landing page marketing (bukan app) belum dibina — Fasa 2.

## Fasa 3 — Billing (Billplz)

Model: setiap akaun ada `subscription_end_date` (mula 14 hari trial). Worker cron
check setiap hari — H-3 sebelum tamat, auto-jana bil Billplz RM15 dan emel link
bayaran. Bila Billplz confirm bayaran (webhook), `subscription_end_date` extend
+30 hari. Kalau tamat tanpa bayar, status jadi `past_due` dan dashboard.html akan
redirect owner ke `billing.html` (block akses sampai bayar).

### Setup

1. **Supabase**: jalankan `supabase/migration_fasa3_billing.sql` di SQL Editor (lepas `schema.sql`).
2. **Billplz**:
   - Daftar akaun di billplz.com (ada mod **Sandbox** percuma untuk testing — guna `billplz-sandbox.com` untuk API kalau nak test dulu sebelum live).
   - Buat satu **Collection** → salin `Collection ID`.
   - Settings → API Keys → salin `Secret Key` (ni `BILLPLZ_API_KEY`).
   - Settings → salin `X Signature Key` (untuk verify webhook — `BILLPLZ_X_SIGNATURE_KEY`).
3. **Cloudflare Pages** → project eqstudio-link → Settings → Environment variables, tambah:
   - `SUPABASE_ANON_KEY`
   - `BILLPLZ_API_KEY`
   - `BILLPLZ_COLLECTION_ID`
   - `BILLPLZ_X_SIGNATURE_KEY`
   - `PUBLIC_SITE_URL` = `https://eqstudio.link`
   - Redeploy lepas tambah.
4. **Worker cron** — set secrets tambahan:
   ```
   npx wrangler secret put BILLPLZ_API_KEY
   npx wrangler secret put BILLPLZ_COLLECTION_ID
   npx wrangler secret put PUBLIC_SITE_URL
   ```
   Lepas tu `npx wrangler deploy` semula.
5. **Test bill sweep manual** (tanpa tunggu cron esok):
   `https://<worker-url>.workers.dev/?key=<MANUAL_TRIGGER_KEY>&run=billing`
6. **Test webhook**: Billplz sandbox ada mod bayaran test (tak perlu kad sebenar) — bayar satu bil sandbox, confirm `bills` table di Supabase tukar status ke `paid` dan `profiles.subscription_end_date` extend.

**Penting**: guna Billplz **Sandbox** dulu untuk semua testing sebelum tukar ke akaun **Live** — proses tukar sandbox→live di Billplz perlukan verification akaun perniagaan (boleh ambil beberapa hari), so mulakan proses tu awal-awal kalau nak live sebelum end-of-trial batch pertama.

## Fasa 4 — Branding & UI Upgrade

- Jalankan `supabase/migration_fasa4_branding.sql` di SQL Editor (lepas migration_fasa3).
- Dashboard sekarang ada 2 tab: **Pelanggan** (form + senarai + stats) dan **Tetapan** (Profil Perniagaan + Jadual Reminder).
- Isi **Profil Perniagaan** (nama bisnes, telefon, emel contact, alamat, logo URL) di tab Tetapan — maklumat ni terus dipaparkan dalam emel reminder yang dihantar Worker cron, supaya customer tahu emel tu dari bisnes sebenar dan macam mana nak hubungi balik.
- Emel reminder sekarang HTML branded penuh (bukan text ringkas) — perlu redeploy Worker cron (`npx wrangler deploy` dalam `worker-cron/`) untuk guna template baru.
- Landing page ada animasi resit (cycle status), reveal-on-scroll, dan section perbandingan baru.

## Fasa 5 — Interaction & Identity Upgrade

- Jalankan `supabase/migration_fasa5_brand_color.sql` di SQL Editor.
- Dashboard sekarang **sidebar app** (bukan tab atas) — nav kekal visible, ada search/filter pelanggan, loading skeleton.
- Profil Perniagaan ada **color picker warna jenama** — warna ni terus dipakai dalam emel reminder (top bar + accent card), jadi setiap bisnes rasa emel diorang sendiri, bukan template generik.
- Landing page: resit hero sekarang **boleh klik** untuk advance status manual (bukan setakat autoplay pasif), dan nama customer boleh ditukar terus dalam resit tu.
- Redeploy Pages DAN Worker cron untuk kedua-dua perubahan ni aktif.

## Fasa 6 — Feature Expansion (payment link, PDF, WhatsApp, analytics)

- Jalankan `supabase/migration_fasa6_features.sql` di SQL Editor.
- **Worker cron** sekarang perlukan dependency baru — dalam folder `worker-cron/`, run `npm install` semula sebelum `npx wrangler deploy` (untuk pasang `pdf-lib`).
- **Link bayaran per-customer**: setiap emel reminder sekarang ada butang "Bayar Sekarang" — customer boleh bayar terus tanpa tunggu owner. Bila dibayar, customer auto-tertanda "Dah Bayar" (webhook Billplz handle ni, tak sentuh subscription owner).
- **Invois PDF**: setiap emel reminder ada lampiran PDF (invois ringkas dengan nama, jumlah, tarikh due, dan contact bisnes).
- **WhatsApp**: isi nombor telefon bila tambah customer → butang "WhatsApp" akan muncul dalam senarai, buka WhatsApp dengan mesej reminder pre-filled untuk owner hantar manual.
- **Laporan**: tab baru dalam dashboard — income bulan ini, jumlah belum diterima, income ikut bulan, dan top 5 customer.
- **Backlog** (belum dibina, next round): import CSV pukal, kalendar view, customer berulang (recurring), digest harian ke owner.

## Fasa 7 — Recurring, Customer Portal, Kalendar, CSV

- Jalankan `supabase/migration_fasa7_recurring_portal.sql` di SQL Editor.
- **CSV Import**: dalam tab Pelanggan, panel "⇪ Import CSV" — format lajur: `nama,emel,telefon,jumlah,tarikh_due,catatan`.
- **Customer berulang**: bila tambah pelanggan, tick "Bayaran berulang" + pilih interval (7/14/30/60 hari). Bila pelanggan tu ditanda "Dah Bayar", Worker cron auto-generate entry baru untuk cycle seterusnya.
- **Kalendar**: tab baru — tengok semua due date dalam satu bulan, klik tarikh untuk lihat senarai pelanggan.
- **Digest harian**: emel ringkasan dihantar ke owner setiap hari (jumlah due, reminder dihantar, overdue) — hanya jika ada aktiviti.
- **Customer Portal**: setiap emel reminder ada link "Lihat status bayaran" — customer boleh check status + bayar tanpa perlu akaun (link unik per customer, `web/portal.html?token=...`).
- **Export Laporan**: butang "Export CSV" dalam tab Laporan — muat turun rekod bayaran terus dari browser.
- Redeploy Pages **dan** Worker cron untuk semua ni aktif (tiada dependency npm baru untuk fasa ni).
- **Belum dibina**: multiple email template per-stage (custom-editable), SMS reminder (perlukan keputusan gateway dulu — bukan free-tier).

## Fasa 12 — Admin: Kawal Business Owner (Suspend, Delete, Extend, Reset Password)

- Jalankan `supabase/migration_fasa12_admin_controls.sql` di SQL Editor.
- Pastikan **`PUBLIC_SITE_URL`** ada dalam Pages environment variables (guna untuk link reset password) — kalau belum ada, tambah (contoh: `https://eqstudio.link`).
- `/admin.html` sekarang ada senarai penuh business owner (bukan setakat stats), dengan search, dan tindakan per owner:
  - **Suspend / Reaktivate** — block/unblock akses dashboard (data owner tak hilang, reversible)
  - **Extend** — tambah hari subscription secara manual (untuk goodwill/support)
  - **Reset PW** — jana link reset kata laluan, admin copy & hantar manual kepada owner (WhatsApp/emel)
  - **Padam** — **permanent**, perlukan taip nama bisnes untuk confirm; cascade padam semua data owner (customers, bills, reminder history) sekali
- Owner yang disuspend akan redirect ke `suspended.html` bila cuba akses dashboard.
- Redeploy Pages untuk aktifkan.

## Fasa 13 — Chatbox Bot FAQ (Landing Page)

Chatbox landing page — bot FAQ sahaja, 100% percuma, tiada backend/migration perlu.

- Klik bubble 💬 kanan bawah untuk buka
- Bot jawab guna keyword-match dari 14 soalan sedia ada, dengan **contoh soalan popular** dipaparkan sebagai chip
- Selepas setiap jawapan, bot cadang **soalan susulan lain** (chip baru, tak ulang yang dah ditanya)
- Butang **↻ Reset** (kat header panel) untuk mula perbualan baru bila-bila

Pure Pages change (index.html + style.css) — redeploy je, tiada langkah setup lain.

## Fasa 15/16 — REVERTED: Kekal Resend + Billplz

Sempat cuba swap ke Amazon SES (emel) dan ToyyibPay (payment) untuk jimat kos jangka panjang, tapi AWS payment method verification gagal — **kekal guna Resend dan Billplz** macam asal.

**Apa yang kekal dari percubaan tu** (berguna regardless provider):
- Table `email_send_log` + tab **Admin Panel → Emel Log** — setiap send attempt (berjaya/gagal) direkod, boleh tengok error sebenar tanpa kena `wrangler tail`. Jalankan `supabase/migration_fasa15_ses_email_log.sql` untuk aktifkan (kalau belum).
- Kolum `bills` table sekarang **gateway-agnostic** (`gateway_bill_id`, `gateway_bill_url`, `payment_gateway`) — kalau nak swap provider lagi masa depan, tak payah migration besar lagi.
- Harga **RM19/bulan** (naik dari RM15) dan emphasis yearly kekal — lihat section Fasa 14 di bawah.

**Setup emel & payment kekal seperti sebelum ni** — guna `RESEND_API_KEY`/`RESEND_FROM_EMAIL` (Worker + Pages) dan `BILLPLZ_API_KEY`/`BILLPLZ_COLLECTION_ID`/`BILLPLZ_X_SIGNATURE_KEY` (Worker + Pages), rujuk Fasa 3 di bawah untuk langkah Billplz asal.

## Fasa 17 — Instant Reminder (elak terlepas cycle cron)

**Masalah**: cron jalan sekali sehari (~9 pagi). Kalau customer ditambah **selepas** cron jalan dengan due date hari ini, reminder "Hari-Ini" untuk dia akan terlepas cycle tu (esok due date jadi overdue, offset berbeza).

**Fix**: bila owner tambah customer dengan tarikh due **hari ini atau lampau**, dashboard automatik check & hantar reminder serta-merta (kalau match jadual reminder owner), tanpa tunggu cron esok.

- **Tak sentuh** CSV bulk import atau Edit customer — instant-check ni cuma untuk form "+ Tambah Pelanggan" satu-satu. Kalau import CSV dengan due date lampau, reminder tetap tunggu cron esok macam biasa.
- Kalau `WORKER_CRON_URL`/`MANUAL_TRIGGER_KEY` belum diset kat Pages, feature ni senyap fail (customer tetap berjaya ditambah, reminder tunggu cron macam biasa) — tak block apa-apa.

### Setup
1. Tambah env var baru kat **Cloudflare Pages** (Settings → Environment variables):
   - `WORKER_CRON_URL` — URL Worker cron anda (contoh `https://eqstudio-link-reminder-cron.nreqmal.workers.dev`)
   - `MANUAL_TRIGGER_KEY` — **value yang SAMA** macam secret `MANUAL_TRIGGER_KEY` yang dah anda set kat Worker cron
2. Redeploy Pages **dan** Worker cron.
3. Test: tambah customer baru dengan Tarikh Due = hari ini, patut nampak toast "Reminder terus dihantar..." lepas beberapa saat, dan emel sampai.

## Fasa 18 — Emel Lebih Premium (shared component + Add-to-Calendar)

Sebab quota Resend limited, fokus pada **kualiti setiap emel** dari setakat kuantiti:

- **Shared email shell** — semua 4 jenis emel (reminder, bil subscription, digest, terima kasih) sekarang guna struktur visual **sama** (top bar warna jenama, logo/nama bisnes, card frame, footer konsisten) — rasa satu produk yang koheren, bukan 4 template berbeza.
- **Add-to-Calendar** — setiap emel reminder ada butang "📅 Tambah ke Kalendar" (link Google Calendar, satu klik) untuk tarikh due — customer boleh set reminder sendiri terus dalam calendar diorang.
- **Digest & bil subscription owner** sekarang guna jenama **milik owner sendiri** (logo, warna) — bukan template generik eqstudio.link — rasa lebih personal walaupun emel ni untuk owner sendiri (bukan customer).
- **Digest** upgrade dari senarai bullet ke visual stat-card (3 kotak warna: due/reminder/tertunggak).
- Tiada migration, tiada env var baru — pure code refactor. Redeploy Pages **dan** Worker cron.

## Fasa 14 — Pricing Tahunan (Monthly vs Yearly)

- Jalankan `supabase/migration_fasa14_yearly_pricing.sql` di SQL Editor.
- **RM15/bulan** atau **RM150/tahun** (jimat RM30 = 2 bulan percuma). Pilihan disimpan (`profiles.subscription_plan`) dan diguna semula untuk auto-renewal bill akan datang.
- Landing page: toggle Bulanan/Tahunan kat section Harga.
- `billing.html`: pilih pelan sebelum jana bil — plan yang dipilih disimpan untuk cycle akan datang.
- Worker cron (auto-generate bil dekat tarikh tamat) dan webhook (extend subscription lepas bayar) kedua-duanya baca `subscription_plan` untuk tentukan jumlah (RM15/RM150) dan tempoh extend (30/365 hari) yang betul.
- Redeploy Pages **dan** Worker cron.

## Fasa 8 — Cara Bayar Alternatif & Tanya Soalan

- Jalankan `supabase/migration_fasa8_payment_options.sql` di SQL Editor.
- Tetapan > Profil Perniagaan ada field baru: **Nama Bank, Nombor Akaun, Nama Pemegang Akaun, QR Code URL** — kalau diisi, terus dipaparkan dalam emel reminder DAN customer portal sebagai alternatif kepada Billplz.
- Emel reminder & customer portal sekarang ada butang **"Ada Soalan? WhatsApp Kami"** — bawa customer terus chat dengan owner (guna nombor telefon dalam Profil Perniagaan).
- Redeploy Pages **dan** Worker cron untuk semua ni aktif.

## Fasa 9 — Upload Terus (Logo & QR Code)

- Jalankan `supabase/migration_fasa9_storage.sql` di SQL Editor — ni setup Supabase Storage bucket `business-assets` (public read, upload terhad kepada pemilik sendiri ikut folder).
- Tetapan > Profil Perniagaan: field **Logo** dan **QR Code** sekarang **file upload terus** (bukan paste link lagi) — pilih gambar dari komputer, terus upload dan preview.
- Selepas upload, tekan **"Simpan Profil"** untuk simpan URL (gambar dah upload ke storage serta-merta, tapi field profil kekal perlu "Simpan" macam field lain).

## Fasa 10 — Field Required, Delete/Revert, Emel Terima Kasih, Riwayat, Invois On-Demand

Tiada migration baru untuk fasa ni. Tapi **Pages Function `invoice-pdf.js` perlukan `pdf-lib`** — root project sekarang ada `package.json` sendiri (berasingan dari `worker-cron/package.json`). Dari **root folder `eqstudio-link/`** (bukan dalam `web/`), run:
```
npm install
```
sebelum `npx wrangler pages deploy web --project-name=eqstudio-link`.

Juga tambah **environment variables baru kat Pages** (Settings > Environment variables) untuk emel "Terima Kasih":
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

(Nilai sama macam yang awak set dalam Worker cron secrets — cuma perlu diletak sekali lagi kat Pages sebab Pages Function jalan berasingan dari Worker.)

Perubahan:
- Semua field Profil Perniagaan (kecuali Logo & QR) sekarang **wajib diisi**.
- Setiap pelanggan ada butang: **Edit, Riwayat, Invois, WhatsApp** (kalau ada telefon), dan **Padam** — plus **"Batal 'Dah Bayar'"** untuk revert balik ke belum bayar.
- **Riwayat**: klik untuk tengok bila-bila reminder sebenarnya berjaya dihantar (bukan setakat status badge).
- **Invois**: muat turun PDF invois bila-bila masa, tanpa tunggu reminder emel.
- **Emel Terima Kasih**: untuk pelanggan "Dah Bayar", owner boleh manually hantar emel confirmation — bukan automatik.

**Belum dibina**: WhatsApp automated reminder (paling kompleks — perlukan keputusan WhatsApp Business API provider berbayar dulu, macam SMS).

## Fasa 11 — Scaling (Queue-based fan-out)

**Kenapa perlu:** Cloudflare Workers hadkan bilangan "subrequest" (panggilan API luar) **setiap satu invocation** — 50 kat Free plan, 1,000 kat Paid plan ($5/bulan). Reminder sweep asal proses setiap customer terus dalam satu loop (~5-8 API call setiap customer) — pada skala kecil ok, tapi pada skala ratusan/ribuan customer sehari, ia akan **exceed limit dan gagal senyap** (sebahagian reminder takkan terhantar, tanpa error jelas).

**Penyelesaian:** Reminder sweep sekarang **dua peringkat**:
1. **Gather** (dalam sweep asal) — kumpul semua customer yang layak hari ni, guna bulk query (bukan satu-satu), pastu hantar setiap satu sebagai **mesej** ke Cloudflare Queue.
2. **Proses** (queue consumer, function `queue()`) — Cloudflare automatik ambil mesej dalam batch kecil (10 pada satu masa) dan proses kerja berat (Billplz + emel + PDF) — dengan **retry automatik** kalau ada yang gagal.

Ni standard practice Cloudflare untuk "fan-out" kerja macam ni, dan boleh handle jauh lebih banyak volume tanpa architecture berubah lagi.

### Setup (WAJIB sebelum deploy)

1. **Upgrade ke Workers Paid plan** ($5/bulan) — Queues **tak available** kat Free plan. Cloudflare dashboard → Workers & Pages → Plans.
2. Buat dua queue (sekali sahaja, sebelum deploy pertama):
   ```
   npx wrangler queues create eqstudio-reminders
   npx wrangler queues create eqstudio-reminders-dlq
   ```
3. Deploy macam biasa:
   ```
   npx wrangler deploy
   ```

### Nota penting

- **Manual trigger** (`?key=...&run=reminders`) sekarang response dia `{"matched":X,"queued":Y}` — bukan `{"sent":X}` lagi. Ni sebab hantar sebenar jadi **beberapa saat lepas** (queue consumer proses async), bukan serta-merta dalam response tu.
- **Billing, recurring, digest sweep** (owner count jauh lebih kecil — ~100, bukan ribuan) kekal macam asal, tak perlu queue buat masa ni. Kalau nanti scale ke ribuan **business owner** (bukan setakat ribuan customer), boleh apply pattern sama.

## Fasa 19 — Template Catatan (Notes)

- Jalankan `supabase/migration_fasa19_note_templates.sql`.
- Bahagian Catatan (dalam Tambah Pelanggan & Edit Pelanggan) sekarang ada **chip template** — klik terus isi, tak payah taip setiap kali:
  - **5 default** disediakan semua owner: Deposit, Baki Penuh, Bayaran Penuh, Yuran Bulanan, Sewa
  - **Custom** — taip catatan sendiri, klik "+ Simpan sebagai template" untuk simpan kekal (disimpan per-owner, kekal untuk kali lain), boleh padam bila-bila (✕ pada chip custom)
- Redeploy Pages je (tiada perubahan Worker cron).

## Fasa 21 — Booking Online (Reposition: Booking & Client Manager)

**Kenapa**: reminder bayaran sahaja cuma "good to have" — booking/scheduling self-serve adalah pain point sebenar (elak kehilangan lead sebab lambat reply WhatsApp). Booking sekarang jadi entry point; deposit/invois/reminder yang sedia ada terus applicable automatik lepas booking confirm — struktur asal (`customers`, invois PDF, Billplz, Resend) **tidak dirombak**, cuma disambung.

### Setup

1. Jalankan `supabase/migration_fasa21_booking.sql`.
2. Redeploy Pages (baca `_redirects` untuk pretty URL `/book/<slug>`).
3. Owner: pergi **Tetapan → 📅 Booking Online** — set link (slug), tempoh slot, notis minimum, **deposit lalai (wajib diisi untuk booking berfungsi)**, dan waktu available (hari + jam).
4. Kongsi link `eqstudio.link/book/<slug>` dengan customer.

### Cara ia berfungsi

- Customer buka link → pilih tarikh/slot kosong → isi nama/emel/telefon/catatan → submit
- Sistem cipta row `customers` (deposit = amaun lalai owner set, due date = hari ini) + row `bookings` (unique constraint `owner_id + slot_datetime` elak double-booking)
- **Reminder deposit dihantar serta-merta** (guna mekanisme instant-reminder Fasa 17 — bukan tunggu cron esok)
- Emel confirmation dihantar ke customer **dan** owner serentak
- Kalau owner belum set deposit lalai, booking page akan tolak dengan mesej jelas ("hubungi terus")

### Nota

- Waktu semua dikira **Asia/Kuala_Lumpur (UTC+8 tetap, tiada DST)** — dikira konsisten dalam `booking-availability.js` dan `booking-create.js`.
- Setiap booking = satu row `customers` **baharu** (sama pattern macam recurring customer generate row baru setiap cycle) — bukan reuse row sedia ada, walaupun emel sama pernah book sebelum ni.
- **Belum dibina** (scope seterusnya lepas flow public ni stabil): dashboard UI untuk owner tengok/urus senarai booking (cancel, reschedule), notification bila slot penuh, dan sinkronisasi ke Kalendar tab sedia ada.

## Fasa 23 — Reschedule Professional (Tier 1 + Tier 2)

Rujukan pattern dari platform booking established (Calendly, Cal.com dsb) — reschedule sentiasa guna **slot sebenar** (bukan free-text date), dan setiap perubahan **auto-notify** pihak lain.

### Tier 1 — Owner reschedule (dashboard)
- Modal reschedule sekarang tunjuk **slot available sebenar** (fetch dari `booking-availability.js`, sama logic dengan public booking page) — bukan datetime input bebas
- Field **"Sebab"** (optional) — dihantar dalam emel notification
- Bila simpan, customer **auto-terima emel** "Tempahan Anda Ditukar" (masa lama → masa baru + sebab)
- Cancel pun sama — prompt sebab, customer auto-terima emel "Tempahan Anda Dibatalkan"

### Tier 2 — Customer self-serve (`manage-booking.html?token=...`)
- Setiap emel confirmation booking sekarang ada butang **"Reschedule / Batal Tempahan"**
- Customer boleh reschedule sendiri (pilih dari slot available sebenar) atau cancel (dengan sebab optional) — **tanpa perlu hubungi owner**
- Owner **auto-terima emel** notification bila customer buat perubahan sendiri

### Setup
1. Jalankan `supabase/migration_fasa23_booking_manage_token.sql`
2. Redeploy Pages (tiada perubahan Worker cron)

## Fasa 24 — Multi-bahasa (BM/English/Mandarin/Tamil)

**Per-customer** — setiap customer pilih bahasa sendiri semasa booking, bukan owner set satu default untuk semua.

**Nota penting**: terjemahan Mandarin (zh) dan Tamil (ta) adalah AI-generated dari training data — sesuai untuk konteks transaksi biasa, tapi **disyorkan disemak oleh penutur asli** sebelum go-live sepenuhnya, terutama untuk elak nada yang janggal atau formaliti yang tak sesuai budaya.

### Setup
1. Jalankan `supabase/migration_fasa24_multilang.sql` (`customers.preferred_language`, default 'ms').
2. Redeploy Pages **dan** Worker cron.

### Skop
- **Booking page** (`book.html`) — language switcher (BM/EN/中文/தமிழ்) di atas, translate seluruh UI page tu + pilihan disimpan bersama booking
- **Emel confirmation booking**, **emel reminder deposit**, **emel terima kasih** — semua dalam bahasa yang customer pilih
- **Customer Portal** (`portal.html`) — paparan status bayaran dalam bahasa customer

Bahasa **owner** (dashboard, admin) kekal Bahasa Melayu — tak berubah, sebab audience utama produk ni.

## Fasa 26 — Buffer Time, Custom Intake Questions, Embeddable Widget

### 1. Buffer Time
Tempoh rehat automatik antara booking (0/5/10/15/30 minit) — set di Tetapan Booking. Diguna pakai secara konsisten dalam kedua-dua slot computation (booking baru + reschedule) via range-overlap check, bukan setakat exact-time match.

**Nota**: buffer time overlap **tidak** dikuatkuasakan di peringkat database (unique constraint asal cuma exact `slot_datetime` match) — dalam race condition sangat jarang (dua orang book serentak dalam zon buffer yang sama), kedua-dua boleh berjaya. Risiko rendah tapi bukan mustahil.

### 2. Custom Intake Questions
Tambah soalan custom (contoh "Apa jenis kek?") di Tetapan Booking — muncul dalam borang booking selepas customer pilih slot. Jawapan disimpan dalam `bookings.custom_answers` (JSONB), dipaparkan dalam emel notification owner dan Senarai Booking dashboard.

### 3. Embeddable Widget
Code iframe auto-generate di Tetapan Booking (bila link aktif) — copy-paste terus ke website sendiri. Height tetap (700px) untuk kesederhanaan — tiada auto-resize dinamik (perlukan JS berjalan di website parent, tak boleh kita jamin).

### Setup
1. Jalankan `supabase/migration_fasa26_buffer_questions_embed.sql`.
2. Redeploy Pages (tiada perubahan Worker cron kali ni).

## Fasa 28 — Forum Komuniti (ganti chat privat)

Full discussion forum — 4 kategori (Pengumuman, Soalan & Bantuan, Cadangan Feature, Perbualan Umum). Semua orang (termasuk visitor) boleh **baca**; cuma owner dengan **langganan aktif** (bukan trial) boleh **post/reply**.

### Setup
1. Jalankan `supabase/migration_fasa28_forum.sql` (cipta table + seed 4 kategori).
2. Redeploy Pages.

### Isi awal forum
Forum mula **kosong** (tiada fake dummy user/thread — sengaja elak, boleh mengelirukan visitor pasal komuniti sebenar). Sebaliknya, pergi **Admin Panel → 📋 Kelola Forum**, post beberapa thread rasmi sebagai **"eqstudio.link Team"** — contoh:
- Kategori Pengumuman: "Selamat Datang ke eqstudio.link!"
- Kategori Soalan & Bantuan: pinned FAQ-style thread

### Cara ia berfungsi
- **Public read**: `forum.html` boleh diakses tanpa login — kategori → senarai thread → thread detail
- **Post/reply**: perlukan Supabase session aktif + `profiles.subscription_status = 'active'` (dikuatkuasakan di RLS, bukan setakat UI)
- **Founder post** (contoh "eqstudio.link Team"): melalui Admin Panel, guna `x-admin-key`, bypass RLS terus (service role)

### Nota
- Chat privat 1-lawan-1 (owner↔founder) yang dibina sebelum ni telah **dibuang sepenuhnya** — digantikan forum ni.

## Fasa 29 — Event Types, RM0 Deposit, Cancellation Window, Pro Tier

Batch besar berdasarkan gap-gap yang dijumpai lepas user pertama daftar & guna sistem.

### Bug fixes
- Field "Alamat (optional)" tak lagi wajib diisi
- Signup emel — explicit `emailRedirectTo` (elak "site can't be reached" akibat setting Supabase dashboard yang tersasar)
- **RM0 deposit** — sekarang boleh set deposit percuma (sengaja), sistem bezakan "tak diisi" dengan "sengaja RM0"

### Event Types (Jenis Perkhidmatan)
Setup di Tetapan Booking → "🎯 Jenis Perkhidmatan". Setiap jenis ada tempoh/deposit/kapasiti sendiri. **Kosongkan** untuk kekal guna tetapan asas (single service, macam sekarang). Customer pilih jenis dulu (kalau ada >1), baru pilih slot.

**Group booking**: set kapasiti >1 untuk servis macam kelas Zumba — beberapa customer boleh book slot sama.

### Book-Again Loop
Lepas booking berjaya, butang "+ Book Sesi Lagi" — customer boleh book slot seterusnya tanpa isi nama/emel semula.

### Cancellation Window
Tetapan Booking → "Notis Minimum Cancel" — had masa customer boleh self-cancel sebelum appointment.

### Pro Tier (Multiple Booking Link)
- **RM39/bulan atau RM390/tahun** — sehingga 3 link booking
- **Nota skop MVP**: link tambahan guna **calendar & tetapan yang SAMA** dengan link utama (alias/vanity URL je) — bukan calendar berasingan sepenuhnya. Kalau perlukan tempoh/availability betul-betul berasingan ikut link, tu upgrade besar seterusnya.

### Setup
1. Jalankan `supabase/migration_fasa29_event_types_pro_tier.sql`
2. Redeploy Pages (tiada perubahan Worker cron kali ni)

### Nota teknikal penting
- Unique constraint `bookings(owner_id, slot_datetime)` **dah dibuang** — capacity>1 perlukan berbilang booking pada slot sama. Conflict checking sekarang di application-level (sama macam buffer time), bukan database-level lagi.
