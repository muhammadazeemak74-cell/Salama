/**
 * OTP challenge storage, in Redis.
 *
 * This is shared state by necessity: a code issued by the pod that answered
 * `request-otp` has to be verifiable by whichever pod answers `verify-otp`
 * moments later, and a restart must not forget every pending login.
 *
 * Each challenge is one key, `otp:<phone>`, written with SETEX so Redis itself
 * enforces the five-minute lifetime — there is no sweeper to get wrong and no
 * way for an expired challenge to linger.
 *
 * Both operations run as Lua scripts because both are read-modify-write. Two
 * pods verifying the same code at the same instant must not each see "one
 * attempt left" and each allow it, and two `request-otp` calls must not both
 * pass the resend cooldown and send two SMS. Lua on Redis is single-threaded,
 * so the whole script is the critical section.
 */

import { createHash, randomInt } from 'node:crypto';

import { getRedis } from '@boloshop/db';

import { config } from './config.ts';

/** One namespace, so the test hook can clear challenges and nothing else. */
const KEY_PREFIX = 'otp:';

function keyFor(phoneNumber: string): string {
  return `${KEY_PREFIX}${phoneNumber}`;
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * Issue: refuse if the previous code is still inside its cooldown, otherwise
 * overwrite it.
 *
 * Returns [1, 0] on success, or [0, retryAfterSeconds] while cooling down.
 */
const ISSUE_SCRIPT = `
local existing = redis.call('GET', KEYS[1])
if existing then
  local ok, decoded = pcall(cjson.decode, existing)
  if ok and decoded and decoded.i then
    local elapsed = (tonumber(ARGV[5]) - decoded.i) / 1000
    local cooldown = tonumber(ARGV[3])
    if elapsed < cooldown then
      return {0, math.ceil(cooldown - elapsed)}
    end
  end
end

local value = cjson.encode({
  h = ARGV[1],
  a = tonumber(ARGV[4]),
  i = tonumber(ARGV[5])
})
redis.call('SETEX', KEYS[1], tonumber(ARGV[2]), value)
return {1, 0}
`;

/**
 * Verify: consume an attempt, and delete the challenge however it resolves —
 * a correct code is single use, and a exhausted one is worthless.
 *
 * Returns [1, 'ok'] or [0, reason].
 *
 * The digests are compared with `~=` rather than a constant-time primitive.
 * What is compared is a SHA-256 of the code, not the code: learning that two
 * digests share a prefix does not narrow the six digits without a preimage
 * attack, and the attempt counter caps guesses at five regardless.
 */
const VERIFY_SCRIPT = `
local existing = redis.call('GET', KEYS[1])
if not existing then
  return {0, 'not_found'}
end

local ok, challenge = pcall(cjson.decode, existing)
if not ok or not challenge then
  redis.call('DEL', KEYS[1])
  return {0, 'not_found'}
end

if challenge.a <= 0 then
  redis.call('DEL', KEYS[1])
  return {0, 'no_attempts_left'}
end

challenge.a = challenge.a - 1

if challenge.h ~= ARGV[1] then
  if challenge.a <= 0 then
    redis.call('DEL', KEYS[1])
    return {0, 'no_attempts_left'}
  end
  -- Keep the original deadline: a wrong guess must not extend the window.
  local ttl = redis.call('TTL', KEYS[1])
  if ttl <= 0 then ttl = 1 end
  redis.call('SETEX', KEYS[1], ttl, cjson.encode(challenge))
  return {0, 'mismatch'}
end

redis.call('DEL', KEYS[1])
return {1, 'ok'}
`;

/** ioredis returns Lua's array reply as a mixed tuple. */
type ScriptReply = [number, string | number];

async function runScript(
  script: string,
  key: string,
  args: (string | number)[],
): Promise<ScriptReply> {
  const reply = await getRedis().eval(script, 1, key, ...args);
  return reply as ScriptReply;
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
export async function issueOtp(phoneNumber: string): Promise<IssuedOtp> {
  const now = Date.now();

  // randomInt is CSPRNG-backed; Math.random is not fit for a credential.
  const max = 10 ** config.otp.length;
  const code = randomInt(0, max).toString().padStart(config.otp.length, '0');

  const [issued, cooldown] = await runScript(ISSUE_SCRIPT, keyFor(phoneNumber), [
    hashCode(code),
    config.otp.ttlSeconds,
    config.otp.resendCooldownSeconds,
    config.otp.maxAttempts,
    now,
  ]);

  if (issued !== 1) {
    throw new OtpCooldownError(Number(cooldown));
  }

  return { code, expiresAt: new Date(now + config.otp.ttlSeconds * 1000) };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'no_attempts_left' | 'mismatch' };

/**
 * Check a submitted code. A challenge is single use, however it resolves.
 *
 * There is no separate `expired` outcome: the SETEX deadline removes the key,
 * so an expired challenge is indistinguishable from one that never existed —
 * which is also all the caller should tell the person on the other end.
 */
export async function verifyOtp(phoneNumber: string, code: string): Promise<VerifyResult> {
  const [ok, reason] = await runScript(VERIFY_SCRIPT, keyFor(phoneNumber), [
    hashCode(code),
  ]);

  if (ok === 1) return { ok: true };

  return {
    ok: false,
    reason: reason as 'not_found' | 'no_attempts_left' | 'mismatch',
  };
}

/**
 * Drop every outstanding challenge.
 *
 * Scans the otp: namespace rather than flushing the database — this Redis also
 * holds seller credit balances, and a test helper must not take those with it.
 */
export async function clearOtpStore(): Promise<void> {
  const redis = getRedis();
  // ioredis applies keyPrefix to keys it sends but not to SCAN's MATCH, so the
  // pattern has to carry it explicitly.
  const prefix = (process.env.REDIS_KEY_PREFIX ?? '') + KEY_PREFIX;

  const keyPrefix = process.env.REDIS_KEY_PREFIX ?? '';

  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 500);
    cursor = next;
    if (keys.length > 0) {
      // SCAN returns fully-qualified names, but ioredis re-applies keyPrefix to
      // the keys of any command it sends — so the prefix comes back off before
      // the delete, or it would be applied twice and match nothing.
      const unprefixed = keys.map((key) =>
        keyPrefix && key.startsWith(keyPrefix) ? key.slice(keyPrefix.length) : key,
      );
      await redis.pipeline(unprefixed.map((key) => ['unlink', key])).exec();
    }
  } while (cursor !== '0');
}
