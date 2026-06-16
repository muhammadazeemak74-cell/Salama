import { NextResponse } from "next/server";
import { toFile } from "openai/uploads";
import { getOpenAI } from "@/lib/openai";
import { getSupabaseAdmin } from "@/lib/supabase";

// Needs Node.js APIs (OpenAI SDK, file handling) and must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Phase 1 serves a single establishment with a well-known id (see
// supabase/migrations/0002_seed_default_establishment.sql).
const DEFAULT_ESTABLISHMENT_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_EMIRATE = "dubai";

// Private bucket for the original recordings. Audio is compliance evidence and
// must never be publicly accessible.
const RECORDINGS_BUCKET = "recordings";

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

type ComplianceStatus = "pass" | "fail" | "unknown";

interface ValidationResult {
  status: ComplianceStatus;
  check: "chiller" | "freezer" | "hot_hold" | null;
  reading_c: number | null;
  limit_c: number | null;
}

/**
 * Lightweight, deterministic pass/fail check against the Dubai Food Code limits
 * already encoded in the system prompt: chiller ≤ 5°C, freezer ≤ -18°C,
 * hot-held food ≥ 63°C. Returns "unknown" when no clear reading + context can
 * be parsed (e.g. non-temperature events, or numbers we cannot interpret).
 */
function determineValidation(transcript: string): ValidationResult {
  // Normalise spoken negatives ("minus 20" -> "-20") before parsing numbers.
  const text = transcript.toLowerCase().replace(/minus\s+/g, "-");

  let check: ValidationResult["check"] = null;
  let limit: number | null = null;
  let comparator: "<=" | ">=" | null = null;

  if (/freez/.test(text)) {
    check = "freezer";
    limit = -18;
    comparator = "<=";
  } else if (/chiller|fridge|refrigerat|chill|walk[- ]?in|cold\s*room/.test(text)) {
    check = "chiller";
    limit = 5;
    comparator = "<=";
  } else if (/hot[- ]?hold|hot\s*food|bain[- ]?marie|keep\s*hot|holding\s*hot/.test(text)) {
    check = "hot_hold";
    limit = 63;
    comparator = ">=";
  }

  // Prefer a number explicitly tied to a temperature unit; otherwise, if we
  // already identified the context, accept the first bare number.
  let reading: number | null = null;
  const withUnit = text.match(
    /(-?\d+(?:\.\d+)?)\s*(?:°|deg|degree|degrees|celsius|c\b)/,
  );
  if (withUnit) {
    reading = Number.parseFloat(withUnit[1]);
  } else if (check) {
    const bare = text.match(/-?\d+(?:\.\d+)?/);
    if (bare) reading = Number.parseFloat(bare[0]);
  }

  if (check === null || comparator === null || limit === null) {
    return { status: "unknown", check, reading_c: reading, limit_c: limit };
  }
  if (reading === null || Number.isNaN(reading)) {
    return { status: "unknown", check, reading_c: null, limit_c: limit };
  }

  const pass = comparator === "<=" ? reading <= limit : reading >= limit;
  return {
    status: pass ? "pass" : "fail",
    check,
    reading_c: reading,
    limit_c: limit,
  };
}

/**
 * Pick a filename extension that matches the uploaded audio's content type.
 * gpt-4o-transcribe decodes by the filename extension, so it must be correct.
 * iOS Safari produces audio/mp4; Chrome/Firefox typically audio/webm.
 */
function extensionForContentType(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes("mp4") || ct.includes("m4a") || ct.includes("aac")) {
    return "mp4";
  }
  if (ct.includes("webm")) return "webm";
  if (ct.includes("ogg")) return "ogg";
  if (ct.includes("wav")) return "wav";
  if (ct.includes("mpeg") || ct.includes("mp3")) return "mp3";
  // Fall back to webm (the common non-iOS case).
  return "webm";
}

/**
 * Persist the original audio to the private "recordings" bucket as compliance
 * evidence and return its storage path. Best-effort: returns null on any
 * failure so a storage problem can never break the core record loop.
 */
async function storeAudioEvidence(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  audio: File,
  contentType: string,
  establishmentId: string,
): Promise<string | null> {
  try {
    // Ensure the bucket exists (private). Ignore the error if it already does.
    const { error: bucketError } = await supabase.storage.createBucket(
      RECORDINGS_BUCKET,
      { public: false },
    );
    if (bucketError && !/exist/i.test(bucketError.message)) {
      // A non "already exists" error is unexpected, but still non-fatal.
      console.error("[record] createBucket error", bucketError);
    }

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const ext = extensionForContentType(contentType);
    const path = `${establishmentId}/${year}/${month}/${crypto.randomUUID()}.${ext}`;

    const buffer = Buffer.from(await audio.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(RECORDINGS_BUCKET)
      .upload(path, buffer, { contentType, upsert: false });

    if (uploadError) {
      console.error("[record] audio upload failed", uploadError);
      return null;
    }

    return path;
  } catch (err) {
    console.error("[record] audio upload failed", err);
    return null;
  }
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

  // Log the received format so we can diagnose decode failures.
  const contentType = audio.type || "application/octet-stream";
  console.log("[record] received audio", {
    contentType,
    bytes: audio.size,
    uploadedName: audio.name,
  });

  const openai = getOpenAI();

  // 1. Transcribe the voice note.
  // gpt-4o-transcribe decodes by filename extension + content type, so build a
  // properly named file via OpenAI's toFile() helper instead of passing the raw
  // blob (which arrives without a usable name and fails to decode).
  let transcript: string;
  try {
    const ext = extensionForContentType(contentType);
    const uploadFile = await toFile(audio, `recording.${ext}`, {
      type: contentType,
    });
    const transcription = await openai.audio.transcriptions.create({
      file: uploadFile,
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

  // 3. Persist the original audio as evidence (best-effort; never fatal).
  const supabase = getSupabaseAdmin();
  const rawInputUrl = await storeAudioEvidence(
    supabase,
    audio,
    contentType,
    DEFAULT_ESTABLISHMENT_ID,
  );

  // 4. Store an immutable compliance record (append-only — see CLAUDE.md).
  try {
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
      raw_input_url: rawInputUrl, // storage path in the private bucket, or null
      parsed_data: { transcript },
      validation_result: determineValidation(transcript),
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
