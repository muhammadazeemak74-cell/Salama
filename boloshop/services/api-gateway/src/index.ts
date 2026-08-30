/**
 * Server entry point.
 *
 * Verifies the database is reachable before binding the port, then shuts both
 * down cleanly on a signal so in-flight requests are not cut off mid-response.
 */

import type { Server } from 'node:http';

import { closePool, ping } from '@boloshop/db';

import { createApp } from './app.ts';
import { config } from './config.ts';

/** How long a shutdown may take before the process is killed anyway. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  // Fail fast on a bad DATABASE_URL rather than serving 503s from /health.
  // The pool is lazy, so this first call is also what opens it.
  await ping();
  console.info('[api-gateway] database reachable');

  const app = createApp();

  const server: Server = app.listen(config.port, () => {
    console.info(`[api-gateway] listening on :${config.port} (${config.nodeEnv})`);
  });

  // Slightly above the 60s a typical load balancer holds a keep-alive, so the
  // proxy closes idle connections first and never races a socket we just shut.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  let shuttingDown = false;

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`[api-gateway] ${signal} received, shutting down`);

    // Do not let a stuck connection hold the process open forever.
    const timer = setTimeout(() => {
      console.error('[api-gateway] shutdown timed out, exiting');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timer.unref();

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      // Express 5 / Node 18+: end idle keep-alive sockets so close() can
      // finish instead of waiting out every one of them.
      server.closeIdleConnections();
    });

    await closePool();
    console.info('[api-gateway] shutdown complete');
    process.exit(0);
  }

  process.on('SIGTERM', (signal) => void shutdown(signal));
  process.on('SIGINT', (signal) => void shutdown(signal));
}

main().catch(async (error: unknown) => {
  console.error('[api-gateway] failed to start', error);
  await closePool().catch(() => undefined);
  process.exit(1);
});
