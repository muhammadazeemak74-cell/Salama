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

  ffmpeg: {
    // Not a path by default: resolved on PATH, like any other CLI.
    binary: process.env.FFMPEG_PATH ?? 'ffmpeg',
    probeBinary: process.env.FFPROBE_PATH ?? 'ffprobe',
    fontPath: resolveFontPath(),
    /** What FONT_PATH was set to, for diagnostics when it does not resolve. */
    fontPathConfigured: configuredFontPath,
    /** A 15s vertical render is CPU-bound; past this something is wrong. */
    timeoutMs: intEnv('RENDER_TIMEOUT_MS', 180_000),
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
