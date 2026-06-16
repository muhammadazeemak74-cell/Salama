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
 * hot-held food ≥ 63°C. Returns "unknown" only when there is genuinely no
 * recognizable context or no parseable number.
 */

// Number words up to 100, so spoken readings ("minus ten", "twenty five") work.
const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

const UNIT_WORDS = new Set(["degree", "degrees", "deg", "celsius", "c"]);

function isNumberWord(tk: string): boolean {
  return tk in ONES || tk in TENS || tk === "hundred";
}

/** Consume consecutive number words starting at `start`; returns value + end. */
function readNumberWords(
  tokens: string[],
  start: number,
): { value: number; end: number } | null {
  let i = start;
  let temp = 0;
  let total = 0;
  let consumed = 0;
  while (i < tokens.length) {
    const w = tokens[i];
    if (w === "hundred") {
      temp = (temp === 0 ? 1 : temp) * 100;
      total += temp;
      temp = 0;
    } else if (w in TENS) {
      temp += TENS[w];
    } else if (w in ONES) {
      temp += ONES[w];
    } else {
      break;
    }
    i++;
    consumed++;
  }
  if (consumed === 0) return null;
  return { value: total + temp, end: i };
}

/**
 * Extract a temperature in °C from natural text. Handles digit ("-10", "5.5",
 * "8 degrees") and word forms ("minus ten", "negative 10", "twenty five"),
 * plus "N below"/"below zero". Pass 1 prefers a number tied to a unit (so
 * "chiller 2 is 8 degrees" reads 8, not 2); pass 2 accepts the first number.
 */
function parseTemperature(text: string): number | null {
  // Separate digits from letters/symbols so "10c"/"minus10"/"10°" tokenize,
  // and drop sentence periods while keeping decimal points ("5.5").
  const norm = text
    .toLowerCase()
    .replace(/°/g, " degrees ")
    .replace(/\.(?!\d)/g, " ")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2");
  const tokens = norm.split(/[\s,]+/).filter(Boolean);

  const scan = (requireUnit: boolean): number | null => {
    for (let i = 0; i < tokens.length; i++) {
      let value: number | null = null;
      let end = i;

      if (/^-?\d+(?:\.\d+)?$/.test(tokens[i])) {
        value = Number.parseFloat(tokens[i]);
        end = i + 1;
      } else if (isNumberWord(tokens[i])) {
        const parsed = readNumberWords(tokens, i);
        if (parsed) {
          value = parsed.value;
          end = parsed.end;
        }
      }
      if (value === null || Number.isNaN(value)) continue;

      // Skip any trailing unit words to look at what follows the reading.
      let after = end;
      let hadUnit = false;
      while (after < tokens.length && UNIT_WORDS.has(tokens[after])) {
        hadUnit = true;
        after += 1;
      }
      if (requireUnit && !hadUnit) continue;

      // Negative cues: "minus/negative N" before, or "N (degrees) below" after.
      const prev = tokens[i - 1];
      if (prev === "minus" || prev === "negative" || prev === "-") {
        value = -Math.abs(value);
      }
      if (tokens[after] === "below") value = -Math.abs(value);

      return value;
    }
    return null;
  };

  const withUnit = scan(true);
  return withUnit !== null ? withUnit : scan(false);
}

function determineValidation(transcript: string): ValidationResult {
  const text = transcript.toLowerCase();

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
  } else if (/hot[- ]?hold|bain[- ]?marie|\bhot\b|holding/.test(text)) {
    check = "hot_hold";
    limit = 63;
    comparator = ">=";
  }

  const reading = parseTemperature(text);

  let status: ComplianceStatus;
  if (check === null || comparator === null || limit === null) {
    status = "unknown";
  } else if (reading === null || Number.isNaN(reading)) {
    status = "unknown";
  } else {
    const pass = comparator === "<=" ? reading <= limit : reading >= limit;
    status = pass ? "pass" : "fail";
  }

  // TEMP DEBUG: trace context/reading/status so we can verify parsing on new
  // recordings. Remove once validation is confirmed in production.
  console.log("[record] validation debug", {
    transcript,
    check,
    limit_c: limit,
    reading_c: reading,
    status,
  });

  return { status, check, reading_c: reading, limit_c: limit };
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
