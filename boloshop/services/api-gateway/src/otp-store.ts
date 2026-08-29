/**
 * OTP challenge storage.
 *
 * IN-MEMORY AND TEMPORARY. It is correct for one process and wrong for two:
 * a code issued by pod A cannot be verified by pod B, and every restart
 * forgets every pending code. Move this to Redis — which the architecture
 * already calls for — before running more than one instance.
 *
 * The interface is deliberately narrow so that swap is a single file.
 */

import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

import { config } from './config.js';

interface Challenge {
  /** SHA-256 of the code. Never keep the plaintext at rest. */
  codeHash: Buffer;
  expiresAt: number;
  attemptsRemaining: number;
  issuedAt: number;
}

const challenges = new Map<string, Challenge>();

function hashCode(code: string): Buffer {
  return createHash('sha256').update(code).digest();
}

/** Drop expired entries so the map cannot grow without bound. */
function evictExpired(now: number): void {
  for (const [phoneNumber, challenge] of challenges) {
    if (challenge.expiresAt <= now) challenges.delete(phoneNumber);
  }
}

export interface IssuedOtp {
  code: string;
  expiresAt: Date;
}

export class OtpCooldownError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`Please wait ${retryAfterSeconds}s before requesting another code.`);
    this.name = 'OtpCooldownError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Issue a code for `phoneNumber`, replacing any outstanding one.
 *
 * Throws `OtpCooldownError` if a code was issued too recently — an SMS gateway
 * charges per message, so this is a billing control as much as a security one.
 */
export function issueOtp(phoneNumber: string): IssuedOtp {
  const now = Date.now();
  evictExpired(now);

  const existing = challenges.get(phoneNumber);
  if (existing) {
    const elapsedSeconds = (now - existing.issuedAt) / 1000;
    if (elapsedSeconds < config.otp.resendCooldownSeconds) {
      throw new OtpCooldownError(Math.ceil(config.otp.resendCooldownSeconds - elapsedSeconds));
    }
  }

  // randomInt is CSPRNG-backed; Math.random is not fit for a credential.
  const max = 10 ** config.otp.length;
  const code = randomInt(0, max).toString().padStart(config.otp.length, '0');
  const expiresAt = now + config.otp.ttlSeconds * 1000;

  challenges.set(phoneNumber, {
    codeHash: hashCode(code),
    expiresAt,
    attemptsRemaining: config.otp.maxAttempts,
    issuedAt: now,
  });

  return { code, expiresAt: new Date(expiresAt) };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'expired' | 'no_attempts_left' | 'mismatch' };

/** Check a submitted code. A challenge is single-use, however it resolves. */
export function verifyOtp(phoneNumber: string, code: string): VerifyResult {
  const now = Date.now();
  const challenge = challenges.get(phoneNumber);

  if (!challenge) return { ok: false, reason: 'not_found' };

  if (challenge.expiresAt <= now) {
    challenges.delete(phoneNumber);
    return { ok: false, reason: 'expired' };
  }

  if (challenge.attemptsRemaining <= 0) {
    challenges.delete(phoneNumber);
    return { ok: false, reason: 'no_attempts_left' };
  }

  challenge.attemptsRemaining -= 1;

  const submitted = hashCode(code);
  // Both are 32-byte SHA-256 digests, so the lengths always match and the
  // comparison stays constant-time.
  if (!timingSafeEqual(submitted, challenge.codeHash)) {
    if (challenge.attemptsRemaining <= 0) {
      challenges.delete(phoneNumber);
      return { ok: false, reason: 'no_attempts_left' };
    }
    return { ok: false, reason: 'mismatch' };
  }

  challenges.delete(phoneNumber);
  return { ok: true };
}

/** Test hook. */
export function clearOtpStore(): void {
  challenges.clear();
}
