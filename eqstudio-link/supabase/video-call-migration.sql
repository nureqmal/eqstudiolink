-- ═══════════════════════════════════════════════════════════
-- Panggilan Video — link konsultasi per jenis perkhidmatan
-- Jalankan dalam Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════

alter table public.event_types add column if not exists video_call_link text;
