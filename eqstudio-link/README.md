# eqstudio.link — Fasa 1 MVP

Automation reminder bayaran untuk business owner solo/kecil. Stack: Cloudflare
Pages (frontend + admin API) + Supabase (DB/Auth) + Cloudflare Worker Cron
(scheduled reminder) + Resend (email).

## Struktur folder

```
eqstudio-link/
├── supabase/
│   └── schema.sql          ← jalankan sekali dalam Supabase SQL Editor
├── web/                     ← deploy folder ini ke Cloudflare Pages
│   ├── index.html            (login/signup)
│   ├── dashboard.html         (customer form + list + reminder settings)
│   ├── admin.html              (founder-only stats page)
│   ├── assets/
│   │   ├── config.js            ← ISI Supabase URL & anon key di sini
│   │   ├── supabase-client.js
│   │   └── style.css
│   └── functions/api/
│       └── admin-stats.js       (Pages Function — guna service role key)
└── worker-cron/              ← deploy ini secara berasingan sebagai Worker
    ├── src/index.js            (logic hantar reminder harian)
    ├── wrangler.toml
    └── package.json
```

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
