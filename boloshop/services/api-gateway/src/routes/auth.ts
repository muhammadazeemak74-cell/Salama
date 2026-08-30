/**
 * Phone-number authentication: request a one-time code, then exchange it for
 * a JWT. There is no password anywhere in BoloShop — the phone is the
 * identity, which is what buyers and sellers in Pakistan actually have.
 *
 *   POST /api/v1/auth/request-otp
 *   POST /api/v1/auth/verify-otp
 */

import { Router } from 'express';
import { queryOne } from '@boloshop/db';
import { z } from 'zod';

import { config } from '../config.ts';
import { HttpError } from '../errors.ts';
import { signAuthToken, type UserRole } from '../middleware/auth.ts';
import { OtpCooldownError, issueOtp, verifyOtp } from '../otp-store.ts';
import { parseOrThrow, phoneNumberSchema } from '../validation.ts';

export const authRouter: Router = Router();

/** Mirrors the language_preference enum in 001_initial_schema.sql. */
const LANGUAGES = [
  'urdu',
  'pashto',
  'punjabi',
  'sindhi',
  'saraiki',
  'balochi',
  'english',
] as const;

const requestOtpSchema = z.object({
  phone_number: phoneNumberSchema,
});

const verifyOtpSchema = z.object({
  phone_number: phoneNumberSchema,
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^[0-9]{${config.otp.length}}$`), `Code must be ${config.otp.length} digits.`),
  /** Optional: set on first sign-in, updated on later ones. */
  language_preference: z.enum(LANGUAGES).optional(),
});

interface UserRow {
  id: string;
  phone_number: string;
  role: UserRole;
  language_preference: (typeof LANGUAGES)[number];
  is_verified: boolean;
}

/**
 * POST /api/v1/auth/request-otp
 *
 * MOCK DELIVERY. The code is generated and stored for real, but nothing sends
 * it: it is logged, and returned in the response outside production so the
 * Flutter team can build against this today. Wire an SMS gateway here — the
 * response shape does not change, the `dev_otp` field simply stops appearing.
 */
authRouter.post('/request-otp', (req, res) => {
  const { phone_number: phoneNumber } = parseOrThrow(requestOtpSchema, req.body);

  let issued;
  try {
    issued = issueOtp(phoneNumber);
  } catch (error) {
    if (error instanceof OtpCooldownError) {
      res.set('Retry-After', error.retryAfterSeconds.toString());
      throw HttpError.tooManyRequests(error.message);
    }
    throw error;
  }

  // Stands in for the SMS send. Never log the code in production.
  if (config.isProduction) {
    console.info('[auth] OTP issued', { phone_number: phoneNumber });
  } else {
    console.info(`[auth] OTP for ${phoneNumber}: ${issued.code}`);
  }

  res.status(202).json({
    status: 'sent',
    phone_number: phoneNumber,
    expires_at: issued.expiresAt.toISOString(),
    resend_after_seconds: config.otp.resendCooldownSeconds,
    ...(config.isProduction ? {} : { dev_otp: issued.code }),
  });
});

/**
 * POST /api/v1/auth/verify-otp
 *
 * Verifies the code, creates the user on first sight (or marks an existing
 * one verified), and returns a signed JWT.
 */
authRouter.post('/verify-otp', async (req, res) => {
  const {
    phone_number: phoneNumber,
    code,
    language_preference: language,
  } = parseOrThrow(verifyOtpSchema, req.body);

  const result = verifyOtp(phoneNumber, code);
  if (!result.ok) {
    // One message for every failure mode: telling a caller whether a code
    // exists for a number, or how many guesses are left, is free information
    // for someone brute-forcing it.
    throw HttpError.unauthorized('That code is not valid. Request a new one.');
  }

  // Upsert on the unique phone_number index. A returning buyer keeps their id,
  // role and history; a new one is created verified.
  const user = await queryOne<UserRow>(
    `INSERT INTO users (phone_number, language_preference, is_verified)
     VALUES ($1, COALESCE($2::language_preference, 'urdu'), TRUE)
     ON CONFLICT (phone_number) DO UPDATE
       SET is_verified = TRUE,
           language_preference =
             COALESCE($2::language_preference, users.language_preference)
     RETURNING id, phone_number, role, language_preference, is_verified`,
    [phoneNumber, language ?? null],
  );

  if (!user) {
    // The upsert always returns a row; if it did not, something is very wrong.
    throw new Error('Upsert of users returned no row.');
  }

  const token = signAuthToken({
    id: user.id,
    phone_number: user.phone_number,
    role: user.role,
  });

  res.status(200).json({
    token,
    token_type: 'Bearer',
    expires_in: config.jwt.expiresInSeconds,
    user,
  });
});
