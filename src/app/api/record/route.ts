import { NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import { getSupabaseAdmin } from "@/lib/supabase";

// Needs Node.js APIs (OpenAI SDK, file handling) and must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Phase 1 serves a single establishment with a well-known id (see
// supabase/migrations/0002_seed_default_establishment.sql).
const DEFAULT_ESTABLISHMENT_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_EMIRATE = "dubai";

// The exact system prompt specified for the gpt-4o interpretation step.
const SYSTEM_PROMPT =
  "You are a UAE food-safety assistant. A kitchen worker has logged something " +
  "by voice. Interpret it as a food-safety event (temperature, delivery, " +
  "cleaning, etc.). Apply Dubai Food Code limits: chillers/fridges must be 5°C " +
  "or below; freezers -18°C or below; hot-held food 63°C or above. If a reading " +
  "is out of range, state the problem plainly and give the one corrective " +
  "action required, in simple language. Reply in the same language the worker " +
  "used. Keep replies under 3 sentences. You never certify food as safe and " +
  "never override the Person In Charge.";

/**
 * Best-effort classification of the log type from the transcript, mapped to the
 * compliance_log_type enum. The prescribed gpt-4o prompt returns a plain reply,
 * so type is derived separately here rather than by changing that prompt.
 */
function classifyType(
  transcript: string,
): "temperature" | "delivery" | "cleaning" | "pest_control" | "other" {
  const t = transcript.toLowerCase();
  if (/(pest|cockroach|rodent|rat|mouse|insect|fly|flies)/.test(t)) {
    return "pest_control";
  }
  if (/(clean|saniti|wash|wipe|disinfect)/.test(t)) return "cleaning";
  if (/(deliver|received|supplier|shipment|goods in)/.test(t)) {
    return "delivery";
  }
  if (
    /(temp|degree|°|celsius|fridge|chiller|freezer|hot[- ]?hold|hot hold)/.test(
      t,
    ) ||
    /-?\d+\s*c\b/.test(t)
  ) {
    return "temperature";
  }
  return "other";
}

/**
 * POST — receive a recorded voice note, transcribe it, interpret it as a
 * food-safety log, store an immutable record, and return transcript + reply.
 */
export async function POST(request: Request) {
  let audio: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("audio");
    if (value instanceof File) audio = value;
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with an 'audio' file." },
      { status: 400 },
    );
  }

  if (!audio || audio.size === 0) {
    return NextResponse.json(
      { error: "No audio received." },
      { status: 400 },
    );
  }

  const openai = getOpenAI();

  // 1. Transcribe the voice note.
  let transcript: string;
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: "gpt-4o-transcribe",
    });
    transcript = transcription.text?.trim() ?? "";
  } catch (err) {
    console.error("[record] transcription failed", err);
    return NextResponse.json(
      { error: "Could not transcribe the audio. Please try again." },
      { status: 502 },
    );
  }

  if (!transcript) {
    return NextResponse.json(
      { error: "Nothing was heard in the recording. Please try again." },
      { status: 422 },
    );
  }

  // 2. Interpret the transcript as a food-safety event.
  let reply: string;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
    });
    reply = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error("[record] interpretation failed", err);
    return NextResponse.json(
      { error: "Could not interpret the recording. Please try again." },
      { status: 502 },
    );
  }

  // 3. Store an immutable compliance record (append-only — see CLAUDE.md).
  try {
    const supabase = getSupabaseAdmin();

    // Ensure the single Phase 1 establishment exists so the FK holds even if
    // the seed migration has not been applied.
    await supabase
      .from("establishments")
      .upsert(
        {
          id: DEFAULT_ESTABLISHMENT_ID,
          name: "Default Establishment (Phase 1)",
          emirate: DEFAULT_EMIRATE,
        },
        { onConflict: "id", ignoreDuplicates: true },
      );

    const { error } = await supabase.from("compliance_logs").insert({
      establishment_id: DEFAULT_ESTABLISHMENT_ID,
      emirate: DEFAULT_EMIRATE,
      logged_by: "web", // browser recording; no per-user auth in Phase 1
      type: classifyType(transcript),
      parsed_data: { transcript },
      corrective_action: reply,
    });

    if (error) throw error;
  } catch (err) {
    // The record could not be saved. Surface an error rather than pretend the
    // immutable log was written.
    console.error("[record] failed to save compliance log", err);
    return NextResponse.json(
      { error: "Recording understood but could not be saved. Please retry." },
      { status: 500 },
    );
  }

  return NextResponse.json({ transcript, reply });
}
