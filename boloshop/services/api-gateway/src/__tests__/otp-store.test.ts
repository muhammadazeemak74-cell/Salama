import { closeRedis, getRedis } from '@boloshop/db';

import { config } from '../config.ts';
import {
  OtpCooldownError,
  clearOtpStore,
  issueOtp,
  verifyOtp,
} from '../otp-store.ts';

/**
 * These run against a real Redis (database 15, see setup-env.ts).
 *
 * The behaviour under test lives in Lua running inside Redis — the attempt
 * counter, the cooldown, the single-use delete — so a fake client would be
 * testing a different implementation than the one that ships.
 */
beforeAll(async () => {
  try {
    await getRedis().ping();
  } catch (error) {
    throw new Error(
      'These tests need Redis on ' +
        `${process.env.REDIS_URL}. Start one with: redis-server --port 6379\n` +
        `Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
});

beforeEach(async () => {
  await clearOtpStore();
});

/**
 * Move a challenge's issue timestamp into the past.
 *
 * The cooldown is the only clock-dependent behaviour here, and Jest's fake
 * timers cannot be used to exercise it: they replace the global setTimeout
 * that ioredis relies on for its own connection and command deadlines, and the
 * client stops responding. Editing the stored timestamp tests the same branch
 * without touching the clock.
 */
async function backdateChallenge(phoneNumber: string, seconds: number): Promise<void> {
  const key = `otp:${phoneNumber}`;
  const redis = getRedis();

  const raw = await redis.get(key);
  if (raw === null) throw new Error(`no challenge stored for ${phoneNumber}`);

  const challenge = JSON.parse(raw) as { i: number };
  challenge.i -= seconds * 1000;

  const ttl = await redis.ttl(key);
  await redis.setex(key, ttl > 0 ? ttl : 60, JSON.stringify(challenge));
}

afterAll(async () => {
  await clearOtpStore();
  await closeRedis();
});

describe('OTP generation', () => {
  it('issues a code of the configured length, all digits', async () => {
    const { code } = await issueOtp('+923001234567');

    expect(code).toHaveLength(config.otp.length);
    expect(code).toMatch(/^[0-9]+$/);
  });

  it('pads a small random value rather than emitting a short code', async () => {
    // randomInt can legitimately return 7, which must render as "000007" and
    // not "7" — a six-digit field that sometimes holds one digit is a bug the
    // SMS template would hide.
    const codes = await Promise.all(
      Array.from({ length: 200 }, (_, i) =>
        issueOtp(`+9230012345${String(i).padStart(2, '0')}`).then((r) => r.code),
      ),
    );

    expect(codes.every((code) => code.length === config.otp.length)).toBe(true);
  });

  it('does not repeat itself across issuances', async () => {
    // Not a randomness test — just a guard against a constant or a counter
    // being wired in where a CSPRNG was intended.
    const codes = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        issueOtp(`+9231112345${String(i).padStart(2, '0')}`).then((r) => r.code),
      ),
    );

    expect(new Set(codes).size).toBeGreaterThan(50);
  });

  it('reports an expiry the configured TTL ahead', async () => {
    const before = Date.now();
    const { expiresAt } = await issueOtp('+923001234567');

    const ttlMs = config.otp.ttlSeconds * 1000;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + ttlMs - 50);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + ttlMs + 50);
  });

  it('stores the code hashed, never in plaintext', async () => {
    const { code } = await issueOtp('+923001234567');

    const raw = await getRedis().get('otp:+923001234567');

    expect(raw).not.toBeNull();
    expect(raw).not.toContain(code);
  });

  it('lets Redis own the deadline via SETEX', async () => {
    await issueOtp('+923001234567');

    const ttl = await getRedis().ttl('otp:+923001234567');

    // Within a second of the configured lifetime, and definitely not -1
    // (no expiry), which would leave challenges alive forever.
    expect(ttl).toBeGreaterThan(config.otp.ttlSeconds - 5);
    expect(ttl).toBeLessThanOrEqual(config.otp.ttlSeconds);
  });

  it('verifies the code it issued', async () => {
    const { code } = await issueOtp('+923001234567');

    await expect(verifyOtp('+923001234567', code)).resolves.toEqual({ ok: true });
  });

  it('is single use — a correct code cannot be replayed', async () => {
    const { code } = await issueOtp('+923001234567');

    await expect(verifyOtp('+923001234567', code)).resolves.toEqual({ ok: true });
    await expect(verifyOtp('+923001234567', code)).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('rejects a code issued for a different number', async () => {
    const { code } = await issueOtp('+923001234567');

    await expect(verifyOtp('+923339876543', code)).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('rejects a wrong code without consuming the challenge', async () => {
    const { code } = await issueOtp('+923001234567');
    const wrong = code === '000000' ? '111111' : '000000';

    await expect(verifyOtp('+923001234567', wrong)).resolves.toEqual({
      ok: false,
      reason: 'mismatch',
    });
    // The real code still works: one fat-fingered digit must not force a resend.
    await expect(verifyOtp('+923001234567', code)).resolves.toEqual({ ok: true });
  });

  it('a wrong guess does not extend the deadline', async () => {
    await issueOtp('+923001234567');
    await getRedis().expire('otp:+923001234567', 42);

    await verifyOtp('+923001234567', '000000');

    const ttl = await getRedis().ttl('otp:+923001234567');
    expect(ttl).toBeLessThanOrEqual(42);
    expect(ttl).toBeGreaterThan(0);
  });

  it('locks out after the configured number of attempts', async () => {
    const { code } = await issueOtp('+923001234567');
    const wrong = code === '000000' ? '111111' : '000000';

    for (let attempt = 1; attempt < config.otp.maxAttempts; attempt += 1) {
      await expect(verifyOtp('+923001234567', wrong)).resolves.toEqual({
        ok: false,
        reason: 'mismatch',
      });
    }

    // The last allowed attempt burns the challenge.
    await expect(verifyOtp('+923001234567', wrong)).resolves.toEqual({
      ok: false,
      reason: 'no_attempts_left',
    });

    // And the correct code is now worthless — brute force costs a resend.
    await expect(verifyOtp('+923001234567', code)).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('counts attempts across clients, not per process', async () => {
    // The point of moving this to Redis: two pods sharing one counter. Two
    // concurrent wrong guesses must consume two attempts, not one each from a
    // private copy.
    const { code } = await issueOtp('+923001234567');
    const wrong = code === '000000' ? '111111' : '000000';

    await Promise.all([
      verifyOtp('+923001234567', wrong),
      verifyOtp('+923001234567', wrong),
      verifyOtp('+923001234567', wrong),
    ]);

    const raw = await getRedis().get('otp:+923001234567');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).a).toBe(config.otp.maxAttempts - 3);
  });

  it('refuses a resend inside the cooldown window', async () => {
    await issueOtp('+923001234567');

    await expect(issueOtp('+923001234567')).rejects.toThrow(OtpCooldownError);
  });

  it('reports how long is left on the cooldown', async () => {
    await issueOtp('+923001234567');

    await expect(issueOtp('+923001234567')).rejects.toMatchObject({
      name: 'OtpCooldownError',
      retryAfterSeconds: expect.any(Number),
    });

    const error = await issueOtp('+923001234567').catch((e: unknown) => e);
    const cooldown = error as OtpCooldownError;
    expect(cooldown.retryAfterSeconds).toBeGreaterThan(0);
    expect(cooldown.retryAfterSeconds).toBeLessThanOrEqual(
      config.otp.resendCooldownSeconds,
    );
  });

  it('does not overwrite the live code when it refuses a resend', async () => {
    const first = await issueOtp('+923001234567');
    await expect(issueOtp('+923001234567')).rejects.toThrow(OtpCooldownError);

    // A refused resend that had already written its own hash would silently
    // invalidate the code the buyer is reading off their phone.
    await expect(verifyOtp('+923001234567', first.code)).resolves.toEqual({
      ok: true,
    });
  });

  it('allows a resend once the cooldown has passed', async () => {
    const first = await issueOtp('+923001234567');
    await backdateChallenge('+923001234567', config.otp.resendCooldownSeconds + 1);

    const second = await issueOtp('+923001234567');

    expect(second.code).not.toBe(first.code);
  });

  it('a resend invalidates the previous code', async () => {
    const first = await issueOtp('+923001234567');
    await backdateChallenge('+923001234567', config.otp.resendCooldownSeconds + 1);

    const second = await issueOtp('+923001234567');

    await expect(verifyOtp('+923001234567', first.code)).resolves.toEqual({
      ok: false,
      reason: 'mismatch',
    });
    await expect(verifyOtp('+923001234567', second.code)).resolves.toEqual({
      ok: true,
    });
  });

  it('forgets a challenge once its TTL elapses', async () => {
    // Redis expires the key itself; there is no sweeper in this process to
    // get wrong. Forcing the deadline down proves the key really carries one.
    const { code } = await issueOtp('+923001234567');
    await getRedis().pexpire('otp:+923001234567', 20);
    await new Promise((resolve) => setTimeout(resolve, 80));

    await expect(verifyOtp('+923001234567', code)).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('reports an unknown number as not found', async () => {
    await expect(verifyOtp('+923009999999', '123456')).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });
  });
});
