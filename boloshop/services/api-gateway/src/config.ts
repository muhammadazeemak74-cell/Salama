/**
 * Environment configuration, read once at startup.
 *
 * Anything missing or malformed fails here, loudly, rather than at the first
 * request that happens to need it.
 */

import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  }
  return value;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got "${raw}".`);
  }
  return parsed;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',

  port: intEnv('PORT', 4000),

  /**
   * Comma-separated allowlist. Empty means "reflect any origin", which is fine
   * for local work and for the Flutter app (native clients send no Origin),
   * but production should name its origins.
   */
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== ''),

  jwt: {
    secret: required('JWT_SECRET'),
    // Pakistani users are on intermittent mobile data; a short-lived token
    // means a lot of avoidable re-logins. Thirty days, revocable later by
    // adding a token version column to users.
    expiresInSeconds: intEnv('JWT_EXPIRES_IN_SECONDS', 60 * 60 * 24 * 30),
    issuer: 'boloshop',
  },

  otp: {
    length: 6,
    ttlSeconds: intEnv('OTP_TTL_SECONDS', 300),
    maxAttempts: intEnv('OTP_MAX_ATTEMPTS', 5),
    // Requests per phone number per window, so an SMS bill cannot be run up.
    resendCooldownSeconds: intEnv('OTP_RESEND_COOLDOWN_SECONDS', 60),
  },

  // Request body cap. Product payloads are small; media never comes through
  // this service.
  jsonBodyLimit: process.env.JSON_BODY_LIMIT ?? '64kb',
} as const;

export type Config = typeof config;
