/**
 * Server entry point.
 *
 * Checks its system dependencies on the way up but does not insist on them: a
 * host without FFmpeg still serves /health — reporting exactly what is missing
 * — and answers render requests with a 503 that says so, which is far more
 * useful than a pod that refuses to boot.
 */

import { mkdir, rm } from 'node:fs/promises';
import type { Server } from 'node:http';

import { closePool, ping } from '@boloshop/db';

import { createApp } from './app.ts';
import { config } from './config.ts';
import { probeFfmpeg } from './services/ffmpeg.ts';

const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Create the upload and render directories, and clear the incoming one.
 *
 * `incoming/` holds only in-flight uploads and per-render scratch, which the
 * render path deletes when it finishes. Anything still there at boot belongs
 * to a render this process was killed in the middle of, so it is garbage —
 * and on a busy host it is garbage that accumulates until the disk fills.
 * Renders are never resumed across a restart, so nothing of value is lost.
 */
async function ensureStorage(): Promise<void> {
  await rm(config.storage.incoming, { recursive: true, force: true });
  await mkdir(config.storage.incoming, { recursive: true });
  await mkdir(config.storage.renders, { recursive: true });
  console.info(`[media-service] storage ready at ${config.storage.root}`);
}

async function reportDependencies(): Promise<void> {
  const ffmpeg = await probeFfmpeg({ force: true });

  if (ffmpeg.available) {
    console.info(`[media-service] ffmpeg ok — ${ffmpeg.version}`);
  } else {
    console.warn(
      `[media-service] ffmpeg NOT FOUND ("${ffmpeg.binary}": ${ffmpeg.error}). ` +
        'Renders will return 503 until it is installed or FFMPEG_PATH is set.',
    );
  }

  if (ffmpeg.fontPath) {
    console.info(`[media-service] overlay font: ${ffmpeg.fontPath}`);
  } else {
    console.warn(
      `[media-service] overlay font NOT FOUND (${ffmpeg.fontError}). ` +
        'Renders will return 503 until FONT_PATH points at a .ttf on this host.',
    );
  }

  // The seller lookup needs the database, but a media host that cannot reach
  // it should still come up and say so on /health.
  try {
    await ping();
    console.info('[media-service] database reachable');
  } catch (error) {
    console.warn(
      `[media-service] database unreachable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function main(): Promise<void> {
  await ensureStorage();
  await reportDependencies();

  const app = createApp();

  const server: Server = app.listen(config.port, () => {
    console.info(`[media-service] listening on :${config.port} (${config.nodeEnv})`);
  });

  // Renders are long; keep sockets alive a little past the usual proxy idle.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  let shuttingDown = false;

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`[media-service] ${signal} received, shutting down`);

    const timer = setTimeout(() => {
      console.error('[media-service] shutdown timed out, exiting');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timer.unref();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeIdleConnections();
    });

    await closePool();
    console.info('[media-service] shutdown complete');
    process.exit(0);
  }

  process.on('SIGTERM', (signal) => void shutdown(signal));
  process.on('SIGINT', (signal) => void shutdown(signal));
}

main().catch(async (error: unknown) => {
  console.error('[media-service] failed to start', error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
