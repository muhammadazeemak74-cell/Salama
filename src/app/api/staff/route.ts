import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isAuthenticated } from "@/lib/auth";
import { DEFAULT_ESTABLISHMENT_ID } from "@/lib/establishment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/staff — list ACTIVE staff for the establishment.
 *
 * Public: the open /record screen needs this to show the "Who is logging?"
 * picker. Returns only id + name (no sensitive data).
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("staff")
      .select("id, name")
      .eq("establishment_id", DEFAULT_ESTABLISHMENT_ID)
      .eq("active", true)
      .order("name", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ staff: data ?? [] });
  } catch (err) {
    console.error("[staff] list failed", err);
    return NextResponse.json({ error: "Could not load staff." }, { status: 500 });
  }
}

/**
 * POST /api/staff { name } — add a staff member. Manager-only (PIN).
 */
export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let name = "";
  try {
    const body = await request.json();
    if (typeof body?.name === "string") name = body.name.trim();
  } catch {
    // fall through
  }
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("staff")
      .insert({ establishment_id: DEFAULT_ESTABLISHMENT_ID, name })
      .select("id, name")
      .single();
    if (error) throw error;
    return NextResponse.json({ staff: data }, { status: 201 });
  } catch (err) {
    console.error("[staff] add failed", err);
    return NextResponse.json({ error: "Could not add staff." }, { status: 500 });
  }
}

/**
 * DELETE /api/staff?id=... — deactivate a staff member (soft remove, so past
 * log attribution is preserved). Manager-only (PIN).
 */
export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing 'id'." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("staff")
      .update({ active: false })
      .eq("id", id)
      .eq("establishment_id", DEFAULT_ESTABLISHMENT_ID);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[staff] deactivate failed", err);
    return NextResponse.json(
      { error: "Could not remove staff." },
      { status: 500 },
    );
  }
}
