/**
 * Environment configuration, read once at startup.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import 'dotenv/config';

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got "${raw}".`);
  }
  return parsed;
}

/**
 * A bold sans with wide coverage, for the overlay text. Whichever of these the
 * host actually has wins; FONT_PATH overrides the search.
 */
const FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
  '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
];

const configuredFontPath = process.env.FONT_PATH?.trim() || undefined;

/**
 * The font to draw overlays with, or undefined if there is none.
 *
 * A configured FONT_PATH is checked like any other candidate: pointing it at a
 * file that is not there must not read as "font available", or the service
 * accepts a render it cannot possibly complete.
 */
function resolveFontPath(): string | undefined {
  if (configuredFontPath !== undefined) {
    return existsSync(configuredFontPath) ? configuredFontPath : undefined;
  }
  return FONT_CANDIDATES.find((candidate) => existsSync(candidate));
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const storageRoot = resolve(process.env.MEDIA_STORAGE_PATH ?? './uploads');

/** A 15s vertical render is CPU-bound; past this something is wrong. */
const renderTimeoutMs = intEnv('RENDER_TIMEOUT_MS', 180_000);

/**
 * The sweeper deletes by modification time, and a work directory's mtime
 * stops moving while FFmpeg encodes — so a TTL shorter than a render could
 * delete the drawtext files out from under a job that is still running. Floor
 * every TTL at twice the render timeout, whatever the environment asks for.
 */
const ttlMinutes = (name: string, fallbackMinutes: number): number =>
  Math.max(intEnv(name, fallbackMinutes) * 60_000, renderTimeoutMs * 2);

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',

  port: intEnv('PORT', 4001),

  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== ''),

  storage: {
    root: storageRoot,
    /** Multer drops uploads here; cleaned up once a render finishes. */
    incoming: resolve(storageRoot, 'incoming'),
    /** Finished MP4s, served read-only over HTTP. */
    renders: resolve(storageRoot, 'renders'),
  },

  /**
   * Ephemeral disk cleanup. See services/sweeper.ts.
   *
   * Without this `renders/` grows on every job and nothing removes from it,
   * which ends as ENOSPC weeks after launch rather than as an error anyone
   * can act on.
   */
  sweeper: {
    /** How often a pass runs. 0 switches the sweeper off entirely. */
    intervalMs: intEnv('MEDIA_SWEEP_INTERVAL_MINUTES', 15) * 60_000,
    /**
     * How long a finished MP4 is kept. A seller fetches a promo in the minutes
     * after it renders, and the job record naming it is evicted from memory
     * after an hour, so a day is already generous.
     */
    renderTtlMs: ttlMinutes('MEDIA_RENDER_TTL_MINUTES', 24 * 60),
    /** How long leftover uploads and scratch are kept. */
    scratchTtlMs: ttlMinutes('MEDIA_SCRATCH_TTL_MINUTES', 60),
    /**
     * Delete the oldest renders when the directory exceeds this many bytes.
     * 0 means no cap, which is the default: discarding a render a seller paid
     * a credit for because the disk is busy is a product decision, not a
     * default. Set it where the volume is small and known.
     */
    maxRenderBytes: intEnv('MEDIA_MAX_RENDER_MB', 0) * 1024 * 1024,
  },

  ffmpeg: {
    // Not a path by default: resolved on PATH, like any other CLI.
    binary: process.env.FFMPEG_PATH ?? 'ffmpeg',
    probeBinary: process.env.FFPROBE_PATH ?? 'ffprobe',
    fontPath: resolveFontPath(),
    /** What FONT_PATH was set to, for diagnostics when it does not resolve. */
    fontPathConfigured: configuredFontPath,
    timeoutMs: renderTimeoutMs,
    /** Re-probe the binary at most this often when /health is polled. */
    probeCacheMs: intEnv('FFMPEG_PROBE_CACHE_MS', 30_000),
  },

  video: {
    width: 1080,
    height: 1920,
    fps: 30,
    durationSeconds: 15,
    /** x264 quality. 23 is a sane default; higher is smaller and softer. */
    crf: intEnv('VIDEO_CRF', 23),
    preset: process.env.VIDEO_PRESET ?? 'veryfast',
  },

  upload: {
    maxImages: 3,
    maxBytesPerImage: intEnv('MAX_IMAGE_BYTES', 12 * 1024 * 1024),
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },

  /** Prefix for returned video URLs. Set to the CDN origin in production. */
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? '').replace(/\/+$/, ''),

  credits: {
    /**
     * What a seller starts with the first time Redis is asked about them.
     * Seeded once per seller; a top-up writes the balance directly.
     */
    startingBalance: intEnv(
      'VIDEO_CREDITS_STARTING_BALANCE',
      intEnv('MOCK_VIDEO_CREDITS_PER_SELLER', 5),
    ),
    costPerRender: intEnv('VIDEO_CREDIT_COST_PER_RENDER', 1),
  },
} as const;

export type Config = typeof config;
