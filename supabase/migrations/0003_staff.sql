-- Salama — Phase 1: staff
--
-- Named kitchen staff for an establishment. Compliance logs are attributed to a
-- staff member (logged_by) instead of a generic "web". Staff are soft-removed
-- via active = false so historical attribution is never lost.

create table if not exists staff (
  id                uuid primary key default gen_random_uuid(),
  establishment_id  uuid not null references establishments (id),
  name              text not null,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists idx_staff_establishment
  on staff (establishment_id, active);
