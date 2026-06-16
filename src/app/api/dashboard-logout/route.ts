import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DASHBOARD_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/dashboard-logout — clear the auth cookie and return to /dashboard. */
export async function GET(request: Request) {
  (await cookies()).delete(DASHBOARD_COOKIE);
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
