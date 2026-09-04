/**
 * Shared Redis access.
 *
 * Redis holds the state that has to be the same on every pod: OTP challenges,
 * seller credit balances, and (later) live-stream stats and active carts. Any
 * of that kept in a process's memory is wrong the moment a second pod starts —
 * a code issued by pod A cannot be verified by pod B.
 *
 * Configuration mirrors the Postgres helper next door: nothing is read at
 * import time, and the client is created on first use so importing this module
 * in a process with no Redis never opens a socket.
 */

import { Cluster, Redis, type ClusterNode } from 'ioredis';

/** Either shape of client. The command surface used here is common to both. */
export type RedisClient = Redis | Cluster;

/** Where localhost lives when nothing is configured. */
export const DEFAULT_REDIS_URL = 'redis://localhost:6379';

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
 * Parses REDIS_CLUSTER_NODES: a comma-separated `host:port` list.
 *
 * Empty means single-node mode against REDIS_URL, which is what a developer's
 * laptop and a single managed instance both look like.
 */
export function clusterNodesFromEnv(raw = process.env.REDIS_CLUSTER_NODES): ClusterNode[] {
  return (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .map((entry) => {
      const [host, port] = entry.split(':');
      return { host: host ?? 'localhost', port: Number.parseInt(port ?? '6379', 10) };
    });
}

/**
 * Options shared by both modes.
 *
 * The return type is inferred rather than annotated as ioredis's `RedisOptions`
 * on purpose: under `exactOptionalPropertyTypes` that interface's optional
 * members widen to `T | undefined`, which ioredis's own constructors then
 * refuse. The inferred literal type has no optional members and passes.
 */
export function redisOptionsFromEnv() {
  return {
    // The offline queue stays on — it is what lets `lazyConnect` work, by
    // holding the first command while the socket is dialled — but it is
    // bounded on both sides so a command cannot sit in it during an outage:
    // maxRetriesPerRequest gives up after a couple of reconnects, and
    // commandTimeout caps any single command. Turning the queue off instead
    // would mean every caller had to connect before its first command, which
    // is a footgun nobody remembers.
    maxRetriesPerRequest: intEnv('REDIS_MAX_RETRIES_PER_REQUEST', 2),
    connectTimeout: intEnv('REDIS_CONNECT_TIMEOUT_MS', 5_000),
    commandTimeout: intEnv('REDIS_COMMAND_TIMEOUT_MS', 3_000),
    // Namespaces every key, so one Redis can host more than one environment
    // without a staging OTP verifying a production login.
    keyPrefix: process.env.REDIS_KEY_PREFIX ?? '',
    lazyConnect: true,
    retryStrategy(times: number) {
      // Back off to a 2s ceiling. Redis outages here are usually short.
      return Math.min(times * 200, 2_000);
    },
  };
}

let client: RedisClient | undefined;

/**
 * The process-wide client.
 *
 * Single node against `REDIS_URL` (default `redis://localhost:6379`), or
 * cluster mode when `REDIS_CLUSTER_NODES` names seed nodes.
 */
export function getRedis(): RedisClient {
  if (client) return client;

  const options = redisOptionsFromEnv();
  const nodes = clusterNodesFromEnv();

  if (nodes.length > 0) {
    client = new Cluster(nodes, {
      redisOptions: options,
      slotsRefreshTimeout: intEnv('REDIS_SLOTS_REFRESH_TIMEOUT_MS', 5_000),
    });
  } else {
    client = new Redis(process.env.REDIS_URL ?? DEFAULT_REDIS_URL, options);
  }

  // Without a listener an 'error' event from a dropped connection is an
  // unhandled event and takes the process down; ioredis reconnects either way.
  client.on('error', (error: Error) => {
    console.error('[boloshop/db] redis error', error.message);
  });

  return client;
}

/**
 * Open the connection and prove Redis answers.
 *
 * Commands connect on demand, so this is not required — it exists so a service
 * can fail at boot rather than on the first request that needs Redis.
 */
export async function connectRedis(): Promise<RedisClient> {
  const redis = getRedis();
  if (redis.status === 'end' || redis.status === 'close' || redis.status === 'wait') {
    await redis.connect();
  }
  await redis.ping();
  return redis;
}

/** Cheap liveness probe for health checks. */
export async function pingRedis(): Promise<boolean> {
  const response = await getRedis().ping();
  return response === 'PONG';
}

/** Close the connection. Call on shutdown; safe to call more than once. */
export async function closeRedis(): Promise<void> {
  if (!client) return;
  const closing = client;
  client = undefined;
  await closing.quit().catch(() => closing.disconnect());
}

/**
 * Replace the client. Tests use this to point at a scratch database; passing
 * undefined drops it so the next getRedis() builds a fresh one.
 */
export function setRedisClient(next: RedisClient | undefined): void {
  client = next;
}
