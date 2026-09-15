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
- **(Sept 2026) Production book.html pecah** — download ZIP dari Google AI Studio untuk "tukar warna CTA" turut bawa 781 baris perubahan style.css yang tak diminta (Hero book.html tertimpa dengan set class berbeza dari sesi/eksperimen AI Studio sebelumnya). "Check diff" dibuat terlalu cepat/cetek untuk saiz sebegini, jadi terlepas. **Pelajaran**: alat tanpa sistem artifact (macam Google AI Studio) eksport SELURUH state semasa projek, bukan diff untuk satu permintaan sahaja — untuk diff besar (>~50-100 baris), jangan andaikan "check cepat" cukup.

## Keputusan workflow (Sept 2026)

**Google AI Studio digunakan untuk idea/rujukan visual sahaja — BUKAN untuk commit terus ke kod sebenar.** Sebab: ia kuat untuk brainstorm reka bentuk pantas (macam pattern yang berjaya — chatbox redesign, trend chart, rujukan "Lensa Kreatif Studio" book.html — semua diadaptasi manual ke kod sebenar dengan verify), tapi lemah dari segi "clean coding"/scope control (insiden di atas). Workflow:
- **Idea/rujukan visual/kod contoh** → Google AI Studio, kongsi hasil dengan Claude untuk dinilai
- **Implementation ke kod sebenar** (kecil atau besar) → Claude sahaja — verify struktur, scope, test sebelum deploy
- **Diff besar dari sumber luar (>~50-100 baris)** → hantar kepada Claude untuk scan dulu sebelum commit, jangan andaikan "check cepat" cukup untuk manusia bukan-teknikal

Staging environment (staging.eqstudio.link) kekal berguna untuk Claude test perubahan besar sebelum production, walaupun migration penuh ke AI Studio tak diteruskan.

## Persekitaran

- Production: `eqstudio.link`, Supabase project asal
- Staging: `staging.eqstudio.link`, Supabase project berasingan (setup Sept 2026), kuota Resend **dikongsi** dengan production

## ⚠️ Had diketahui

- **Workers Build untuk `worker-cron` gagal khusus untuk branch `staging`** ("root directory not found"), walaupun struktur fail identikal dengan `main` (yang berjaya). Punca **belum** dikenal pasti — kemungkinan isu cache/config Cloudflare untuk branch baharu. **Kesan**: production worker (dari `main`) **selamat**, tak terjejas. **Tapi**: perubahan pada logic `worker-cron/` (contoh: template emel reminder) **tak** boleh di-test via staging sehingga isu ni dibetulkan — perlu semak kod dengan lebih teliti sebelum push perubahan jenis ni ke `main`.
