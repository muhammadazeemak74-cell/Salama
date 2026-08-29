/**
 * Shared Zod schemas and the bridge from a Zod failure to an HTTP 400.
 */

import { z } from 'zod';

import { HttpError } from './errors.js';

/**
 * E.164, as stored in the database: a leading +, then 8–15 digits.
 * Pakistani mobile numbers arrive as +923XXXXXXXXX.
 */
export const phoneNumberSchema = z
  .string()
  .trim()
  .regex(
    /^\+[1-9][0-9]{7,14}$/,
    'Phone number must be in E.164 format, for example +923001234567.',
  );

/**
 * PKR amount as a decimal string with at most two places. Money is kept as a
 * string end to end — see packages/db — so it never passes through a float.
 */
export const pkrAmountSchema = z
  .union([z.string(), z.number()])
  .transform((value) => (typeof value === 'number' ? value.toString() : value.trim()))
  .refine(
    (value) => /^\d{1,10}(\.\d{1,2})?$/.test(value),
    'Amount must be a non-negative number with at most two decimal places.',
  );

/** Offset pagination. The cap is deliberate: mobile clients on slow links. */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Parse `input`, or throw a 400 carrying every field-level message. */
export function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  throw HttpError.badRequest(
    'Request validation failed.',
    result.error.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    })),
  );
}
