/**
 * Runs before any module is imported.
 *
 * config.ts throws on a missing JWT_SECRET by design — that is the behaviour
 * that stops a misconfigured pod from booting — so the tests have to provide
 * one before anything pulls config in.
 */
process.env.JWT_SECRET ??= 'test-secret-not-for-production';
process.env.NODE_ENV ??= 'test';

// Deterministic OTP behaviour: the defaults are already these values, but a
// developer with a .env exporting different ones should not change what the
// tests assert.
process.env.OTP_TTL_SECONDS ??= '300';
process.env.OTP_MAX_ATTEMPTS ??= '5';
process.env.OTP_RESEND_COOLDOWN_SECONDS ??= '60';
