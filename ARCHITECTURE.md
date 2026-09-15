# EQSTUDIO.LINK — Architecture Map

**Bisnes**: Micro-SaaS booking & client management untuk solo business owner Malaysia. Starter RM19/bulan, Pro RM39/bulan, Founding Member RM15/bulan (dikunci selama-lamanya).

**Stack**: Cloudflare Pages (frontend + Functions) + Cloudflare Worker (cron) + Supabase (DB/Auth/Storage/Realtime) + Resend (emel).

---

## PRESENTATION LAYER (UI/frontend)

```
web/
├── index.html          — Landing page (marketing, chatbot FAQ)
├── login.html           — Login/signup owner
├── dashboard.html        — App utama SPA (goToPage() navigate dalam SATU fail)
├── billing.html          — Manual bank-transfer, Founding Member
├── book.html             — Halaman tempahan awam (data-driven, guna booking-availability.js)
├── portal.html           — Customer portal (akses via portal_token, TIADA login)
├── manage-booking.html   — UI lama, KIV/tak aktif
├── forum.html
├── admin.html
├── demo.html             — Mod demo (mock Supabase client)
└── assets/
    ├── style.css         — SATU fail CSS untuk SEMUA halaman
    ├── config.js         — Supabase URL/key (hostname-detection untuk staging)
    ├── supabase-client.js
    ├── i18n-ui.js, notices.js, toast.js
```

## BUSINESS LOGIC / API (Cloudflare Pages Functions)

Setiap fail = SATU endpoint. Kategori:

**Booking teras**: `booking-availability.js` (baca slot), `booking-create.js` (cipta booking + emel confirmation), `booking-customer-action.js`/`booking-customer-manage.js` (customer reschedule/cancel sendiri), `booking-notify.js` (owner reschedule/cancel, notify customer)

**Chat**: `chat-customer-send.js`, `chat-customer-poll.js` (customer, POLLING bukan Realtime — sebab RLS privacy), `chat-notify-customer.js` (throttled email), `chat-customer-booking-detail.js`

**Emel**: `send-receipt-email.js`, `resend-webhook.js` (delivery tracking), `_web-push-lib.js`/`_send-push-to-owner.js`/`save-push-subscription.js`/`trigger-push.js` (Web Push)

**Bayaran**: `billplz-webhook.js`, `claim-payment.js`, `create-bill.js`, `invoice-pdf.js`

**Admin**: `admin-*.js` (9 fail — audit log, metrics, owner management)

**Forum**: `forum-*.js` (4 fail)

**Lain**: `contact-submit.js`, `customer-portal.js`, `founding-member-count.js`, `trigger-instant-reminder.js`

## SCHEDULED (Worker)

`worker-cron/src/index.js` — reminder deposit, reminder janji temu, resit, ringkasan harian, peringatan langganan. Emel guna `emailShell()` helper (Clean SaaS Receipt style: gradient header, info card, status badge).

## DATA LAYER (Supabase)

Jadual utama: `profiles`, `customers`, `event_types`, `booking_links`, `bookings`, `availability_dates`, `gallery_images`, `testimonials`, `chat_messages`, `chat_faq_templates`, `bills`, `email_send_log`, `reminders_log`, `notifications`, `push_subscriptions`, `forum_categories/threads/replies`, `notices`, `admin_audit_log`.

**RLS pattern kritikal**: Owner guna Supabase Auth session terus (`auth.uid()=owner_id`). Customer **TIADA** akaun Auth — akses SEMUA data melalui Cloudflare Function guna service role key + validate `portal_token` di server. **JANGAN** guna RLS `using(true)` untuk data peribadi.

**Storage buckets**: `gallery`, `posters`.

## INTEGRASI

- **Resend** — emel (free tier 100/hari, 3000/bulan — dikongsi semua jenis emel)
- **Supabase Realtime** — owner chat sahaja (customer guna polling, bukan Realtime)
- **Billplz** — payment gateway (webhook)
- **Web Push** — notification browser

## SISTEM KRITIKAL (protected — rujuk AI_RULES.md)

- Booking creation/reschedule/cancel logic
- Sistem emel (deposit reminder, confirmation, resit)
- RLS policies (privacy customer)
- Autentikasi owner

## PERSEKITARAN

- **Production**: `eqstudio.link` (branch `main`)
- **Staging**: `staging.eqstudio.link` (branch `staging`) — Supabase project **berasingan**, `config.js` hostname-detect automatik pilih Supabase yang betul
