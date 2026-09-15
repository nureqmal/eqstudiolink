# EQSTUDIO.LINK — Changelog & Keputusan Penting

## Status semasa (Sept 2026)
- 52 migration database siap (`migration_fasa3` hingga `fasa52`)
- Sistem chat owner↔customer (post-booking sahaja) siap
- "Website Saya" (book.html sebagai laman peribadi bisnes) siap
- Redesign emel penuh (13 jenis, "Clean SaaS Receipt" style) siap
- Staging environment (staging.eqstudio.link, Supabase berasingan) siap disetup

## Keputusan reka bentuk penting (jangan re-litigate tanpa sebab kukuh)

- **book.html** sengaja estetika BERBEZA dari landing page — neutral/modern (Fresha/spa-app style), bukan gradient rainbow landing page.
- **Chat customer** sengaja guna POLLING (bukan Realtime) — RLS untuk customer anonymous (tiada Supabase Auth) berisiko privasi kalau guna `using(true)`.
- **Chat scope**: selepas booking SAHAJA (bukan pre-booking) — elak risiko spam/beban owner.
- **Tiada** fabrication testimoni/statistik — sentiasa data sebenar atau seksyen hilang terus.
- **Verified badge** book.html conditional pada `ssm_number` sebenar sahaja — bukan dekoratif.
- **4 bahasa** (ms/en/zh/ta) untuk semua teks customer-facing di book.html/portal.html/worker-cron.
- Bahasa Melayu **formal** dalam dashboard, lebih santai di landing page.

## Insiden yang dah diselesaikan (elak ulang)

- CSS Galeri pernah hilang SEPENUHNYA dari repo (versi lama style.css overwrite versi baharu semasa push) — sentiasa verify fresh clone sebelum bina di atas kod sedia ada.
- `.book-social-icon` pernah disangka "dead code" dan dibuang, rupanya masih digunakan — sentiasa `grep` penggunaan sebenar sebelum buang apa-apa.
- Button custom pernah "hilang" (teks putih atas putih) sebab tak reset style global `button {}`.

## Persekitaran

- Production: `eqstudio.link`, Supabase project asal
- Staging: `staging.eqstudio.link`, Supabase project berasingan (setup Sept 2026), kuota Resend **dikongsi** dengan production

## ⚠️ Had diketahui

- **Workers Build untuk `worker-cron` gagal khusus untuk branch `staging`** ("root directory not found"), walaupun struktur fail identikal dengan `main` (yang berjaya). Punca **belum** dikenal pasti — kemungkinan isu cache/config Cloudflare untuk branch baharu. **Kesan**: production worker (dari `main`) **selamat**, tak terjejas. **Tapi**: perubahan pada logic `worker-cron/` (contoh: template emel reminder) **tak** boleh di-test via staging sehingga isu ni dibetulkan — perlu semak kod dengan lebih teliti sebelum push perubahan jenis ni ke `main`.
