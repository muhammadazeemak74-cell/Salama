/**
 * BoloShop shared PostgreSQL access.
 *
 * Exposes one lazily-created connection pool for the whole process, plus the
 * two helpers every service actually needs: `query` for one-shot statements
 * and `withTransaction` for anything that has to be atomic (orders, team
 * purchases, stock decrements).
 *
 * Configuration comes from the environment — see `.env.example`.
 */

import pg from 'pg';
import type { PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';

const { Pool, types } = pg;

/**
 * NUMERIC comes back from `pg` as a string by default, because a JS number
 * cannot hold every value a NUMERIC can. Money must not silently lose paisa,
 * so we keep that default and expose the columns as strings — parse with a
 * decimal library at the edge that needs arithmetic, never with parseFloat.
 *
 * BIGINT (int8) gets the same treatment for the same reason.
 */
export const NUMERIC_OID = 1700;
export const INT8_OID = 20;

// Documented explicitly rather than left implicit: re-assert the string parser
// so a future dependency cannot register a lossy one behind our back.
types.setTypeParser(NUMERIC_OID, (value: string) => value);
types.setTypeParser(INT8_OID, (value: string) => value);

/** Load a local .env file if one exists. Real deployments inject env directly. */
function loadEnvFile(): void {
  // process.loadEnvFile is available from Node 20.12; ignore a missing file.
  const load = (process as NodeJS.Process & { loadEnvFile?: (path?: string) => void })
    .loadEnvFile;
  if (typeof load !== 'function') return;
  try {
    load();
  } catch {
    // No .env on disk — the environment is expected to be populated already.
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        'Set DATABASE_URL, or all of PGHOST/PGDATABASE/PGUSER/PGPASSWORD. ' +
        'See packages/db/.env.example.',
    );
  }
  return value;
}

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
 * Build the pool configuration from the environment.
 *
 * `DATABASE_URL` wins when present (that is what managed Postgres providers
 * hand you); otherwise the discrete PG* variables are used.
 */
export function poolConfigFromEnv(): PoolConfig {
  loadEnvFile();

  const shared: PoolConfig = {
    // A gateway pod does not need many connections; Postgres does not enjoy
    // thousands of them. Tune per service via PGPOOL_MAX.
    max: intEnv('PGPOOL_MAX', 10),
    idleTimeoutMillis: intEnv('PGPOOL_IDLE_TIMEOUT_MS', 30_000),
    // Fail fast instead of hanging a request behind an exhausted pool.
    connectionTimeoutMillis: intEnv('PGPOOL_CONNECTION_TIMEOUT_MS', 5_000),
    application_name: process.env.PGAPPNAME ?? 'boloshop',
  };

  // Managed Postgres almost always terminates TLS with a certificate this
  // process has no CA for; PGSSLMODE=no-verify keeps the encryption and skips
  // the check, matching libpq's own semantics.
  const sslMode = process.env.PGSSLMODE;
  if (sslMode === 'no-verify') {
    shared.ssl = { rejectUnauthorized: false };
  } else if (sslMode !== undefined && sslMode !== 'disable') {
    shared.ssl = { rejectUnauthorized: true };
  }

  if (process.env.DATABASE_URL) {
    return { ...shared, connectionString: process.env.DATABASE_URL };
  }

  return {
    ...shared,
    host: requiredEnv('PGHOST'),
    port: intEnv('PGPORT', 5432),
    database: requiredEnv('PGDATABASE'),
    user: requiredEnv('PGUSER'),
    password: requiredEnv('PGPASSWORD'),
  };
}

let pool: pg.Pool | undefined;

/**
 * The process-wide pool. Created on first use so that importing this module
 * never opens a socket (and never throws) in a process that has no database.
 */
export function getPool(): pg.Pool {
  if (pool) return pool;

  pool = new Pool(poolConfigFromEnv());

  // An idle client erroring out (server restart, network blip) emits on the
  // pool. Without a listener that is an unhandled 'error' event and takes the
  // process down; pg discards the broken client either way.
  pool.on('error', (error: Error) => {
    console.error('[boloshop/db] idle client error', error);
  });

  return pool;
}

/** Run a single statement on a pooled connection. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as unknown[] | undefined);
}

/** Run a statement and return its rows. */
export async function queryRows<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[],
): Promise<T[]> {
  const result = await query<T>(text, params);
  return result.rows;
}

/** Run a statement expected to match at most one row. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[],
): Promise<T | undefined> {
  const rows = await queryRows<T>(text, params);
  if (rows.length > 1) {
    throw new Error(`Expected at most one row, got ${rows.length}.`);
  }
  return rows[0];
}

/**
 * Run `fn` inside a transaction on a single dedicated client.
 *
 * Commits on return, rolls back on throw, and always releases the client. Use
 * the passed client for every statement inside `fn` — calling the module-level
 * `query` there would grab a different connection outside the transaction.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // The connection is already broken; surface the original failure.
      console.error('[boloshop/db] rollback failed', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Cheap liveness probe for health checks. */
export async function ping(): Promise<boolean> {
  const result = await query<{ ok: number }>('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
}

/** Close the pool. Call on shutdown; safe to call more than once. */
export async function closePool(): Promise<void> {
  if (!pool) return;
  const closing = pool;
  pool = undefined;
  await closing.end();
}

export type { PoolClient, PoolConfig, QueryResult, QueryResultRow };
