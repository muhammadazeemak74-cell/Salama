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

// The credit ledger defaults, asserted by the tests, independent of any .env
// a developer happens to have.
process.env.MOCK_VIDEO_CREDITS_PER_SELLER ??= '5';
process.env.VIDEO_CREDIT_COST_PER_RENDER ??= '1';
