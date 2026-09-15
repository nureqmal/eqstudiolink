# EQSTUDIO.LINK — AI Development Rules

**Baca fail ni SEBELUM buat sebarang perubahan.** Ini aplikasi production dengan pengguna sebenar.

---

## ⚠️ FAKTA STRUKTUR PENTING (baca dulu — struktur ni BUKAN modular)

Codebase ni **BUKAN** React/Vue dengan folder `/components` yang terasing. Struktur sebenar:

- **`web/assets/style.css`** — SATU fail CSS (~1200+ rules) **dikongsi** oleh SEMUA halaman (dashboard.html, index.html, book.html, portal.html, login.html, billing.html, admin.html). Perubahan CSS untuk SATU halaman **berisiko** jejaskan halaman lain kalau nama class generic (contoh `.card`, `.btn`) diubah tanpa periksa penggunaan di fail LAIN.
- **`web/dashboard.html`** — SATU fail besar (~5000+ baris), semua fungsi app utama (SPA-style, guna `goToPage()` untuk navigate antara "page" dalam SATU fail).
- **`functions/api/*.js`** — setiap fail = SATU Cloudflare Pages Function (endpoint API berasingan). **38 fail** setakat ni.
- **`worker-cron/src/index.js`** — SATU Cloudflare Worker berjadual (reminder, resit, ringkasan harian).

**Kesan langsung**: sebelum ubah SEBARANG selector dalam `style.css`, kau MESTI `grep` untuk pastikan class tu **hanya** digunakan dalam fail yang diminta, bukan dikongsi.

---

## 🔴 SEBELUM UBAH APA-APA — LANGKAH WAJIB

1. **Cari dulu, jangan assume.** Kalau diminta ubah sesuatu, `grep`/cari kod sebenar untuk pastikan ia wujud dan faham konteks penuh — jangan reka bentuk berdasarkan tekaan struktur.
2. **Kalau selector/function dikongsi > 1 fail**, JANGAN ubah rule sedia ada — cipta selector/function BAHARU khas untuk keperluan ni.
3. **Verify fail betul-betul terkini** sebelum bina di atasnya — kod tempatan mungkin tak sepadan dengan repo GitHub kalau belum di-push.

## 🔴 PERATURAN ASAS

1. **JANGAN** refactor, rename, atau restructure kod sedia ada melainkan diminta secara eksplisit.
2. **HANYA** ubah fail yang benar-benar diperlukan untuk permintaan tersebut.
3. **Kekalkan** semua fungsi sedia ada — jangan buang "kod yang nampak tak digunakan" tanpa verify dulu (ada kes sebenar dalam projek ni: satu class CSS disangka "dead code" dan dibuang, rupanya masih digunakan).
4. **JANGAN** ubah skema database, API routes, logic booking, logic emel, atau authentication melainkan diminta secara eksplisit untuk permintaan tersebut.
5. Permintaan **UI-sahaja** (contoh: "buat butang ni lagi premium") sepatutnya **HANYA** sentuh CSS/HTML — jangan sentuh logic booking/database/API.
6. Permintaan **feature baharu** (contoh: "tambah reschedule") **BOLEH** sentuh backend/database/API — tapi HANYA bahagian yang genuinely diperlukan untuk feature tersebut.
7. **Sentiasa** sertakan cache-buster bump (`style.css?v=N`) pada fail HTML yang diubah bila `style.css` disentuh — check nombor **tertinggi** merentasi SEMUA fail HTML dulu (nombor version selalu berbeza antara fail, jangan assume).
8. **Sentiasa** kekalkan sokongan 4 bahasa (ms/en/zh/ta) untuk teks customer-facing baharu di book.html/portal.html — jangan tambah hanya untuk BM.
9. **Elak** hardcode warna (`#fff`, `#000`) — guna CSS variable (`var(--surface)`, `var(--ink)`) supaya dark mode kekal berfungsi.
10. **Tiada** em-dash (—) dalam teks customer-facing.

## 🟡 SEBELUM SELESAI — VERIFIKASI WAJIB

1. Check syntax (JS: `node --check`; HTML: kira `<div>` vs `</div>` balance; CSS: kira `{` vs `}` balance).
2. Kalau ubah fungsi/algoritma matematik (contoh: kalkulasi tarikh, kurva), **test** secara berasingan sebelum letak dalam kod sebenar.
3. Senaraikan **semua** fail/function yang disentuh, dan sahkan senarai tu sepadan dengan skop permintaan — kalau tak sepadan, itu tanda amaran.
4. Verify `<button>` custom yang dicipta ada reset eksplisit untuk `color`/`background` (button global set warna putih — kalau tak reset, teks jadi tak nampak).

## PROTECTED — jangan ubah melainkan diminta EKSPLISIT untuk perubahan tersebut

- `functions/api/booking-*.js` — logic booking teras
- `functions/api/*-email*.js`, `worker-cron/src/index.js` — sistem emel
- `supabase/*.sql` — skema database (RLS policies terutamanya — customer TIADA akaun Supabase Auth, akses melalui Function + portal_token sahaja)
- Autentikasi (Supabase Auth flow dalam login.html/dashboard.html)

**"Protected" tak bermaksud "tak boleh sentuh langsung"** — ia bermaksud "jangan sentuh sebagai kesan sampingan permintaan lain". Kalau permintaan **memang** perlukan perubahan di sini (contoh: "tambah cara bayaran baharu"), itu sah — tapi hadkan perubahan kepada apa yang benar-benar diperlukan.
