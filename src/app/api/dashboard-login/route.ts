import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  DASHBOARD_COOKIE,
  DASHBOARD_COOKIE_MAX_AGE,
  expectedToken,
  pinMatches,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/dashboard-login  { pin: string }
 *
 * Verifies the PIN against DASHBOARD_PIN server-side and, on success, sets a
 * 30-day httpOnly cookie. The PIN is never returned to the browser.
 */
export async function POST(request: Request) {
  let pin = "";
  try {
    const body = await request.json();
    if (typeof body?.pin === "string") pin = body.pin;
  } catch {
    // fall through to the invalid-PIN response
  }

  const token = expectedToken();
  if (!token) {
    return NextResponse.json(
      { error: "Dashboard is locked. No PIN is configured." },
      { status: 503 },
    );
  }

  if (!pin || !pinMatches(pin)) {
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  (await cookies()).set(DASHBOARD_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DASHBOARD_COOKIE_MAX_AGE,
  });

  return NextResponse.json({ ok: true });
}
