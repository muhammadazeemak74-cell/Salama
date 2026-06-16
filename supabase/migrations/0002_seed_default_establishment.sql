-- Salama — Phase 1 seed
--
-- Phase 1 serves exactly ONE establishment (see CLAUDE.md "Phase plan"). Every
-- compliance_logs row needs a valid establishment_id, so we seed a single
-- establishment with a well-known fixed UUID that the app references directly.
--
-- The /api/record route also upserts this same row at request time, so the app
-- works even if this seed has not been applied — but keeping it here documents
-- the default and makes a fresh DB inspection-ready.

insert into establishments (id, name, emirate, address, pic_name, pic_phone)
values (
  '00000000-0000-0000-0000-000000000001',
  'Default Establishment (Phase 1)',
  'dubai',
  null,
  null,
  null
)
on conflict (id) do nothing;
