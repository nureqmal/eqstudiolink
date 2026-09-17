# Google Calendar Sync — Rangka Kerja Teknikal (v1, one-way push)

## Fail baharu diperlukan

### `functions/api/google-calendar-auth-start.js`
- Dipanggil bila owner klik "Sambungkan Google Calendar" di Profil Perniagaan.
- Bina URL Google OAuth consent (dengan `client_id`, `redirect_uri`, `scope=calendar.events`, `access_type=offline` — perlu untuk dapat `refresh_token`, `prompt=consent`).
- Redirect owner ke URL tersebut.

### `functions/api/google-calendar-callback.js`
- Google redirect balik ke sini selepas owner benarkan akses, bawa `code` query param.
- Tukar `code` → `access_token` + `refresh_token` (panggil Google's token endpoint).
- Simpan dalam `google_calendar_connections` (refresh_token **disulitkan**, bukan plaintext — guna `env.CALENDAR_TOKEN_ENCRYPTION_KEY`).
- Redirect owner balik ke `/dashboard.html?page=tetapan-profil&calendar=connected`.

### `functions/api/google-calendar-disconnect.js`
- Padam row dari `google_calendar_connections` untuk owner tersebut.
- (Pilihan) Panggil Google's token revoke endpoint supaya token mati sepenuhnya di pihak Google.

### `functions/lib/google-calendar-push.js` (helper, bukan endpoint awam)
- Fungsi dikongsi: `pushBookingToCalendar(env, booking, action)` di mana `action` ialah `"create" | "update" | "delete"`.
- Semak `google_calendar_connections` untuk owner tersebut — kalau tiada row, **skip senyap** (bukan semua owner sambung).
- Kalau `access_token` dah luput, guna `refresh_token` untuk dapat token baharu dulu (dan update row).
- Panggil Google Calendar API:
  - `create` → `POST /calendars/{calendarId}/events`, simpan `event.id` balik ke `bookings.google_event_id`
  - `update` → `PATCH /calendars/{calendarId}/events/{eventId}`
  - `delete` → `DELETE /calendars/{calendarId}/events/{eventId}`
- Bungkus dalam try/catch — **kegagalan push tak boleh gagalkan booking itu sendiri**. Log error ke `last_sync_error`, teruskan flow biasa.

## Integrasi dengan endpoint sedia ada

Perlu cari dan kemas kini fail-fail yang **create/update/cancel** booking (belum saya semak lagi dalam sesi ni — nama tepat mungkin berbeza):
- Endpoint yang **create booking baharu** (dipanggil dari book.html selepas pelanggan hantar borang) → panggil `pushBookingToCalendar(env, booking, "create")` selepas insert berjaya.
- `booking-notify.js` (yang saya dah nampak sebelum ni, handle reschedule/cancel notification) → tambah panggilan `pushBookingToCalendar(env, booking, "update")` atau `"delete"` mengikut `type`.

## Environment Variables baharu (Cloudflare Pages)

| Nama | Nilai |
|---|---|
| `GOOGLE_CALENDAR_CLIENT_ID` | Dari Google Cloud Console |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Dari Google Cloud Console |
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | Kunci rawak awak jana sendiri (untuk sulitkan refresh_token sebelum simpan dalam DB) |

## Frontend (dashboard.html — Profil Perniagaan)

Widget baharu dalam Profil Perniagaan:
- **Belum sambung**: butang "Sambungkan Google Calendar" → `window.location.href = "/api/google-calendar-auth-start"`
- **Dah sambung**: badge hijau "Google Calendar Disambungkan" + butang "Putuskan Sambungan" (panggil `/api/google-calendar-disconnect`, refresh UI)
- Baca status dari `google_calendar_connections` bila load Profil Perniagaan (query terus dari Supabase client-side, RLS dah lindungi).

## Skop yang **sengaja ditinggalkan** untuk v1

- ❌ 2-way sync (baca "busy" dari kalendar peribadi owner untuk block slot) — jauh lebih kompleks (perlukan webhook/polling untuk dengar perubahan dari Google)
- ❌ Pilih kalendar spesifik (v1: guna kalendar "primary" owner sahaja — boleh tambah dropdown pilihan kalendar di v2)
- ❌ Retry automatik bila push gagal — v1 cuma log error, owner boleh nampak dalam UI kalau nak

## Susunan kerja dicadangkan

1. Awak siapkan Google Cloud Console setup (bahagian 1 di atas)
2. Saya bina SQL migration (dah siap, fail di atas) — awak jalankan dalam Supabase
3. Saya bina 3 endpoint + helper function
4. Saya bina UI widget dalam Profil Perniagaan
5. Saya cari & kemas kini booking create/reschedule/cancel endpoint sedia ada untuk panggil helper
6. Test end-to-end dengan akaun Google awak sendiri
