/**
 * GET /health — liveness and readiness in one endpoint.
 *
 * Returns 200 when the database answers and 503 when it does not, so a load
 * balancer can drain a pod that has lost its database without the pod having
 * to exit.
 */

import { Router } from 'express';
import { ping } from '@boloshop/db';

export const healthRouter: Router = Router();

const startedAt = Date.now();

interface HealthBody {
  status: 'ok' | 'degraded';
  service: 'api-gateway';
  timestamp: string;
  uptime_seconds: number;
  checks: {
    database: {
      status: 'ok' | 'error';
      latency_ms: number;
      error?: string;
    };
  };
}

healthRouter.get('/health', async (_req, res) => {
  const startedCheck = process.hrtime.bigint();

  let databaseOk = false;
  let databaseError: string | undefined;
  try {
    databaseOk = await ping();
  } catch (error) {
    databaseError = error instanceof Error ? error.message : String(error);
  }

  const latencyMs = Number(process.hrtime.bigint() - startedCheck) / 1_000_000;

  const body: HealthBody = {
    status: databaseOk ? 'ok' : 'degraded',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
    checks: {
      database: {
        status: databaseOk ? 'ok' : 'error',
        latency_ms: Math.round(latencyMs * 100) / 100,
        ...(databaseError ? { error: databaseError } : {}),
      },
    },
  };

  // Health output is a point-in-time reading; never let a proxy cache it.
  res.set('Cache-Control', 'no-store');
  res.status(databaseOk ? 200 : 503).json(body);
});
