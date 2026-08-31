import { config } from '../config.ts';
import {
  OtpCooldownError,
  clearOtpStore,
  issueOtp,
  verifyOtp,
} from '../otp-store.ts';

describe('OTP generation', () => {
  beforeEach(() => {
    clearOtpStore();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('issues a code of the configured length, all digits', () => {
    const { code } = issueOtp('+923001234567');

    expect(code).toHaveLength(config.otp.length);
    expect(code).toMatch(/^[0-9]+$/);
  });

  it('pads a small random value rather than emitting a short code', () => {
    // randomInt can legitimately return 7, which must render as "000007" and
    // not "7" — a six-digit field that sometimes holds one digit is a bug the
    // SMS template would hide.
    const codes = Array.from({ length: 200 }, (_, i) =>
      issueOtp(`+9230012345${String(i).padStart(2, '0')}`).code,
    );

    expect(codes.every((code) => code.length === config.otp.length)).toBe(true);
  });

  it('does not repeat itself across issuances', () => {
    // Not a randomness test — just a guard against a constant or a counter
    // being wired in where a CSPRNG was intended.
    const codes = new Set(
      Array.from({ length: 100 }, (_, i) =>
        issueOtp(`+9231112345${String(i).padStart(2, '0')}`).code,
      ),
    );

    expect(codes.size).toBeGreaterThan(50);
  });

  it('reports an expiry the configured TTL ahead', () => {
    const before = Date.now();
    const { expiresAt } = issueOtp('+923001234567');

    const ttlMs = config.otp.ttlSeconds * 1000;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + ttlMs - 50);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + ttlMs + 50);
  });

  it('verifies the code it issued', () => {
    const { code } = issueOtp('+923001234567');

    expect(verifyOtp('+923001234567', code)).toEqual({ ok: true });
  });

  it('is single use — a correct code cannot be replayed', () => {
    const { code } = issueOtp('+923001234567');

    expect(verifyOtp('+923001234567', code).ok).toBe(true);
    expect(verifyOtp('+923001234567', code)).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('rejects a code issued for a different number', () => {
    const { code } = issueOtp('+923001234567');

    expect(verifyOtp('+923339876543', code)).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('rejects a wrong code without consuming the challenge', () => {
    const { code } = issueOtp('+923001234567');
    const wrong = code === '000000' ? '111111' : '000000';

    expect(verifyOtp('+923001234567', wrong)).toEqual({
      ok: false,
      reason: 'mismatch',
    });
    // The real code still works: one fat-fingered digit must not force a resend.
    expect(verifyOtp('+923001234567', code).ok).toBe(true);
  });

  it('locks out after the configured number of attempts', () => {
    const { code } = issueOtp('+923001234567');
    const wrong = code === '000000' ? '111111' : '000000';

    for (let attempt = 1; attempt < config.otp.maxAttempts; attempt += 1) {
      expect(verifyOtp('+923001234567', wrong)).toEqual({
        ok: false,
        reason: 'mismatch',
      });
    }

    // The last allowed attempt burns the challenge.
    expect(verifyOtp('+923001234567', wrong)).toEqual({
      ok: false,
      reason: 'no_attempts_left',
    });

    // And the correct code is now worthless — brute force costs a resend.
    expect(verifyOtp('+923001234567', code)).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('refuses a resend inside the cooldown window', () => {
    issueOtp('+923001234567');

    expect(() => issueOtp('+923001234567')).toThrow(OtpCooldownError);
  });

  it('reports how long is left on the cooldown', () => {
    issueOtp('+923001234567');

    try {
      issueOtp('+923001234567');
      throw new Error('expected a cooldown error');
    } catch (error) {
      expect(error).toBeInstanceOf(OtpCooldownError);
      const cooldown = error as OtpCooldownError;
      expect(cooldown.retryAfterSeconds).toBeGreaterThan(0);
      expect(cooldown.retryAfterSeconds).toBeLessThanOrEqual(
        config.otp.resendCooldownSeconds,
      );
    }
  });

  it('allows a resend once the cooldown has passed', () => {
    jest.useFakeTimers();
    issueOtp('+923001234567');

    jest.advanceTimersByTime(config.otp.resendCooldownSeconds * 1000 + 1000);

    expect(() => issueOtp('+923001234567')).not.toThrow();
  });

  it('a resend invalidates the previous code', () => {
    jest.useFakeTimers();
    const first = issueOtp('+923001234567');

    jest.advanceTimersByTime(config.otp.resendCooldownSeconds * 1000 + 1000);
    const second = issueOtp('+923001234567');

    expect(verifyOtp('+923001234567', first.code)).toEqual({
      ok: false,
      reason: 'mismatch',
    });
    expect(verifyOtp('+923001234567', second.code).ok).toBe(true);
  });

  it('expires a code after its TTL', () => {
    jest.useFakeTimers();
    const { code } = issueOtp('+923001234567');

    jest.advanceTimersByTime(config.otp.ttlSeconds * 1000 + 1000);

    expect(verifyOtp('+923001234567', code)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('reports an unknown number as not found', () => {
    expect(verifyOtp('+923009999999', '123456')).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });
});
