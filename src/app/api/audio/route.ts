import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// Needs the service role + must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECORDINGS_BUCKET = "recordings";
const SIGNED_URL_TTL_SECONDS = 60;

/**
 * GET /api/audio?path=<storage path>
 *
 * The "recordings" bucket is PRIVATE (compliance evidence). This route mints a
 * short-lived signed URL with the service role and redirects to it, so an
 * <audio> element can stream the file without exposing the bucket publicly.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Missing 'path'." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(RECORDINGS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      console.error("[audio] could not sign url", { path, error });
      return NextResponse.json({ error: "Audio not found." }, { status: 404 });
    }

    // Redirect the media request straight to the time-limited signed URL.
    return NextResponse.redirect(data.signedUrl, 302);
  } catch (err) {
    console.error("[audio] unexpected error", err);
    return NextResponse.json({ error: "Audio unavailable." }, { status: 500 });
  }
}
