/**
 * Runs before any module is imported.
 *
 * config.ts resolves MEDIA_STORAGE_PATH at import time. Pointing it at a temp
 * directory keeps a test run from creating ./uploads in the working directory
 * — the storage tests pass their own paths explicitly, but importing config is
 * enough to compute the default.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.NODE_ENV ??= 'test';
process.env.MEDIA_STORAGE_PATH ??= mkdtempSync(join(tmpdir(), 'boloshop-media-test-'));

// The credit defaults, asserted by the tests, independent of any .env a
// developer happens to have.
process.env.VIDEO_CREDITS_STARTING_BALANCE ??= '5';
process.env.VIDEO_CREDIT_COST_PER_RENDER ??= '1';

// Credit balances are Redis-backed, so these tests need a real server — the
// Lua deduct script is the thing under test. Database 15 and a key prefix keep
// the suite clear of anything else, including the api-gateway suite.
process.env.REDIS_URL ??= 'redis://localhost:6379/15';
process.env.REDIS_KEY_PREFIX ??= 'test:media:';
