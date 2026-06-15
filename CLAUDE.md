# CLAUDE.md — Salama (working name)

## What we're building
An AI food-safety compliance assistant for UAE food establishments. Kitchen
staff log compliance events (temperatures, deliveries, cleaning, pest control)
via WhatsApp — voice notes in their own language (Urdu/Hindi/Tagalog/Arabic)
or photos. The AI transcribes, validates against the Dubai Food Code, stores
an immutable timestamped record, and replies with the required corrective
action in the sender's language. The Person In Charge (PIC) gets a dashboard
and exports inspection-ready records.

We are a SOFTWARE VENDOR, not a food business or certification body. The app
keeps records, trains staff, and prepares for inspection. It NEVER certifies
food as safe and NEVER overrides the PIC's judgment.

## Tech stack
- Next.js (App Router) + TypeScript
- Supabase (Postgres + Auth + Storage)
- WhatsApp Cloud API (Meta) for messaging in/out
- OpenAI: gpt-4o (vision + reasoning), gpt-4o-transcribe (voice notes)
- Deploy: Vercel, single app, webhook as a route handler

## Architecture principles (do not violate)
1. Compliance logs are APPEND-ONLY. Never edited or deleted. A correction is
   a NEW record that references the original.
2. Every record carries: establishment_id, emirate, logged_by, timestamp,
   type, raw_input_url (audio/photo), parsed_data, validation_result,
   corrective_action.
3. Multi-emirate from day one: thresholds keyed by emirate. Launch with Dubai
   Food Code values; schema must allow Abu Dhabi (ADAFSA) / Sharjah later.
4. The AI suggests corrective actions FROM the Food Code knowledge base only.
   It does not invent food-safety advice. If unsure, it escalates to the PIC.
5. Never claim certification. Never replace mandated PIC training.

## Phase plan
- Phase 1 (NOW): ONE establishment. WhatsApp webhook → receive voice note OR
  photo → transcribe/extract → parse a temperature log → validate vs
  thresholds → store immutable record → reply with confirmation + corrective
  action in sender's language. Minimal dashboard listing records.
- Phase 2: Multi-tenant, onboarding, more log types, PIC dashboard with gaps.
- Phase 3: Mock-inspection mode, staff training quizzes, exports, analytics.
- Later: DMChecked integration, supplier traceability data.

## Conventions
- One concern at a time. Verify each change builds before moving on.
- Secrets in environment variables, never committed: OPENAI_API_KEY,
  WHATSAPP_TOKEN, WHATSAPP_VERIFY_TOKEN, WHATSAPP_PHONE_ID, SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY.

## Current task
Do ONLY the task given in chat. Ask before expanding scope.
