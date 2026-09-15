// ── ISI DI SINI ───────────────────────────────────────────────────────
// Dapatkan dua nilai ni dari Supabase Dashboard > Project Settings > API
// SUPABASE_ANON_KEY selamat untuk letak dalam frontend code (public key,
// akses data dikawal oleh Row Level Security dalam schema.sql).
//
// STAGING SETUP: kod ni automatik detect hostname dan pilih Supabase
// project yang betul — staging.eqstudio.link (dan *.pages.dev preview URL)
// guna project STAGING, domain lain (eqstudio.link) guna PRODUCTION.
// Tak perlu tukar config.js secara manual bila deploy ke branch berbeza.
const isStaging = typeof window !== "undefined" &&
  (window.location.hostname.includes("staging") || window.location.hostname.endsWith(".pages.dev"));

const PRODUCTION_URL = "https://piezelkmhhfwydgriejb.supabase.co";
const PRODUCTION_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZXplbGttaGhmd3lkZ3JpZWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDI4OTQsImV4cCI6MjEwMjI3ODg5NH0.9ilysxm-N-QLBHE7B8fiPf-OdCWhjQIMynxC-boSHz4";

// ⚠️ GANTI DUA NILAI NI selepas cipta Supabase project staging baharu
// (Supabase Dashboard > Project Settings > API, untuk project STAGING)
const STAGING_URL = "https://rlaaaommmbdlwrzuokpl.supabase.co";
const STAGING_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsYWFhb21tbWJkbHdyenVva3BsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0Mzc2NjEsImV4cCI6MjEwNTAxMzY2MX0.IybUuCKyuoS6UUbq1A6efnp8f6eUHPzPlmo8YDB5wMw";

export const SUPABASE_URL = isStaging ? STAGING_URL : PRODUCTION_URL;
export const SUPABASE_ANON_KEY = isStaging ? STAGING_ANON_KEY : PRODUCTION_ANON_KEY;
