-- Salama — Phase 1 schema
--
-- Two tables:
--   1. establishments       — the food businesses we keep records for.
--   2. compliance_logs       — APPEND-ONLY immutable record of compliance events.
--
-- See CLAUDE.md "Architecture principles":
--   * Compliance logs are APPEND-ONLY. Never edited or deleted. A correction is
--     a NEW record that references the original (corrects_log_id).
--   * Multi-emirate from day one: every record carries its emirate so emirate-
--     keyed thresholds (Dubai today; Abu Dhabi / Sharjah later) can be applied.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- UAE emirates. Phase 1 launches with Dubai values, but the schema supports all.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'emirate') then
    create type emirate as enum (
      'dubai',
      'abu_dhabi',
      'sharjah',
      'ajman',
      'umm_al_quwain',
      'ras_al_khaimah',
      'fujairah'
    );
  end if;
end$$;

-- Kinds of compliance event. Phase 1 only parses temperature logs, but the
-- type is recorded on every record so later phases can add more.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'compliance_log_type') then
    create type compliance_log_type as enum (
      'temperature',
      'delivery',
      'cleaning',
      'pest_control',
      'other'
    );
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- establishments
-- ---------------------------------------------------------------------------
create table if not exists establishments (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  emirate         emirate not null,
  -- Free-form location / unit details for now; structured later if needed.
  address         text,
  -- The Person In Charge (PIC) responsible for this establishment.
  pic_name        text,
  pic_phone       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Keep updated_at current on establishments (these ARE mutable, unlike logs).
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_establishments_updated_at on establishments;
create trigger trg_establishments_updated_at
  before update on establishments
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- compliance_logs  (APPEND-ONLY)
-- ---------------------------------------------------------------------------
create table if not exists compliance_logs (
  id                  uuid primary key default gen_random_uuid(),
  establishment_id    uuid not null references establishments (id),
  -- Denormalized from the establishment so thresholds can be applied by emirate
  -- without a join, and so the record stays self-describing forever.
  emirate             emirate not null,
  -- WhatsApp sender identifier (phone number / wa_id) of the staff member.
  logged_by           text not null,
  -- When the compliance EVENT occurred (may differ from created_at).
  event_at            timestamptz not null default now(),
  type                compliance_log_type not null,
  -- Supabase Storage URL of the original voice note or photo, if any.
  raw_input_url       text,
  -- Structured data extracted from the input (e.g. {"reading_c": 4.2, ...}).
  parsed_data         jsonb,
  -- Outcome of validating parsed_data against emirate thresholds.
  validation_result   jsonb,
  -- Corrective action returned to the sender (from the Food Code KB only).
  corrective_action   text,
  -- A correction is a NEW row that points at the row it supersedes.
  corrects_log_id     uuid references compliance_logs (id),
  created_at          timestamptz not null default now()
);

create index if not exists idx_compliance_logs_establishment
  on compliance_logs (establishment_id, created_at desc);

create index if not exists idx_compliance_logs_corrects
  on compliance_logs (corrects_log_id);

-- --- Append-only enforcement -----------------------------------------------
-- Compliance records are immutable: block UPDATE and DELETE at the DB level so
-- the rule holds regardless of which client or key is used.
create or replace function prevent_compliance_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'compliance_logs is append-only: % is not allowed. Insert a correcting row that sets corrects_log_id instead.',
    tg_op;
  return null;
end;
$$;

drop trigger if exists trg_compliance_logs_no_update on compliance_logs;
create trigger trg_compliance_logs_no_update
  before update on compliance_logs
  for each row
  execute function prevent_compliance_log_mutation();

drop trigger if exists trg_compliance_logs_no_delete on compliance_logs;
create trigger trg_compliance_logs_no_delete
  before delete on compliance_logs
  for each row
  execute function prevent_compliance_log_mutation();
