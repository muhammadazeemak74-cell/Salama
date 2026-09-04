/**
 * Stand-in for @boloshop/db.
 *
 * Two different jobs here. The Redis helpers are re-exported from the real
 * source, because the credit balance genuinely lives in Redis and the Lua
 * script is what these tests exist to check. The Postgres side is faked: the
 * seller lookup is one SELECT, and standing up a database to assert that
 * `findSeller` passes its argument through would test nothing.
 *
 * Mapping to the source (rather than the package) also sidesteps Jest's
 * CommonJS runtime being unable to require the package's ESM build.
 */

export {
  DEFAULT_REDIS_URL,
  closeRedis,
  clusterNodesFromEnv,
  connectRedis,
  getRedis,
  pingRedis,
  redisOptionsFromEnv,
  setRedisClient,
  type RedisClient,
} from '../../../../../packages/db/src/redis.ts';

type QueryRow = Record<string, unknown>;

/** Set by a test to decide what the next seller lookup returns. */
export const dbStub = {
  queryOne: jest.fn<Promise<QueryRow | undefined>, [string, unknown[]?]>(),
  reset(): void {
    dbStub.queryOne.mockReset();
    dbStub.queryOne.mockResolvedValue(undefined);
  },
};

export const queryOne = (sql: string, params?: unknown[]) =>
  dbStub.queryOne(sql, params);

export const ping = jest.fn<Promise<boolean>, []>().mockResolvedValue(true);
export const closePool = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
