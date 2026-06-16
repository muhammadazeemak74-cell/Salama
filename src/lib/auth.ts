import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "crypto";

/**
 * Simple shared-PIN gate for the manager-facing pages (pilot only).
 *
 * The PIN is read from DASHBOARD_PIN (server-side only, never sent to the
 * browser). We store a derived token in an httpOnly cookie — not the PIN
 * itself — and verify by recomputing and comparing in constant time. If
 * DASHBOARD_PIN is unset, the pages are treated as locked.
 */
export const DASHBOARD_COOKIE = "dashboard_auth";
export const DASHBOARD_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Token stored in the cookie when authenticated; null if no PIN configured. */
export function expectedToken(): string | null {
  const pin = process.env.DASHBOARD_PIN;
  if (!pin) return null;
  return createHash("sha256").update(`salama:${pin}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Constant-time check of a submitted PIN against DASHBOARD_PIN. */
export function pinMatches(candidate: string): boolean {
  const pin = process.env.DASHBOARD_PIN;
  if (!pin) return false;
  return safeEqual(candidate, pin);
}

/** Whether the current request carries a valid auth cookie. */
export async function isAuthenticated(): Promise<boolean> {
  const token = expectedToken();
  if (!token) return false; // locked when no PIN is configured
  const value = (await cookies()).get(DASHBOARD_COOKIE)?.value;
  if (!value) return false;
  return safeEqual(value, token);
}
