/**
 * GET /health — liveness and readiness in one endpoint.
 *
 * Returns 200 when the database answers and 503 when it does not, so a load
 * balancer can drain a pod that has lost its database without the pod having
 * to exit.
 */

import { Router } from 'express';
import { ping, pingRedis } from '@boloshop/db';

export const healthRouter: Router = Router();

const startedAt = Date.now();

interface DependencyCheck {
  status: 'ok' | 'error';
  latency_ms: number;
  error?: string;
}

interface HealthBody {
  status: 'ok' | 'degraded';
  service: 'api-gateway';
  timestamp: string;
  uptime_seconds: number;
  checks: {
    database: DependencyCheck;
    redis: DependencyCheck;
  };
}

/** Times one dependency probe and turns a throw into a reported error. */
async function check(probe: () => Promise<boolean>): Promise<DependencyCheck> {
  const started = process.hrtime.bigint();
  try {
    const ok = await probe();
    return {
      status: ok ? 'ok' : 'error',
      latency_ms: elapsedMs(started),
    };
  } catch (error) {
    return {
      status: 'error',
      latency_ms: elapsedMs(started),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function elapsedMs(started: bigint): number {
  return Math.round(Number(process.hrtime.bigint() - started) / 10_000) / 100;
}

healthRouter.get('/health', async (_req, res) => {
  // Probed together: a health check that takes as long as the sum of its
  // dependencies is the first thing to time out during an incident.
  const [database, redis] = await Promise.all([check(ping), check(pingRedis)]);

  // Both are required to serve a request: Postgres holds the catalog, Redis
  // holds the OTP challenges that gate every sign-in.
  const healthy = database.status === 'ok' && redis.status === 'ok';

  const body: HealthBody = {
    status: healthy ? 'ok' : 'degraded',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
    checks: { database, redis },
  };

  // Health output is a point-in-time reading; never let a proxy cache it.
  res.set('Cache-Control', 'no-store');
  res.status(healthy ? 200 : 503).json(body);
});
