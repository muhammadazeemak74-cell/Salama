/**
 * Forward-only SQL migration runner.
 *
 * Every `.sql` file in ../migrations is applied once, in filename order, each
 * inside its own transaction. Applied files are recorded in
 * `schema_migrations` along with a checksum, so editing a migration that has
 * already run is caught rather than silently ignored.
 *
 *   npm run migrate --workspace @boloshop/db          # apply pending
 *   npm run migrate:status --workspace @boloshop/db   # report only
 *
 * There is deliberately no `down`: rolling a schema backwards in production
 * loses data. Fix a bad migration with a new one.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { closePool, getPool } from './index.ts';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

interface Migration {
  filename: string;
  sql: string;
  checksum: string;
}

interface AppliedRow {
  filename: string;
  checksum: string;
}

/**
 * A session-level advisory lock keyed on an arbitrary constant, so two pods
 * booting at once cannot apply the same migration twice.
 */
const MIGRATION_LOCK_KEY = 8_314_552_071_234_001n;

async function ensureMigrationsTable(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      checksum    TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function loadMigrations(): Promise<Migration[]> {
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    // Filenames are zero-padded (001_, 002_), so a plain sort is the apply order.
    .sort((a, b) => a.localeCompare(b, 'en'));

  return Promise.all(
    filenames.map(async (filename) => {
      const sql = await readFile(join(MIGRATIONS_DIR, filename), 'utf8');
      return {
        filename,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex'),
      };
    }),
  );
}

async function loadApplied(): Promise<Map<string, string>> {
  const result = await getPool().query<AppliedRow>(
    'SELECT filename, checksum FROM schema_migrations',
  );
  return new Map(result.rows.map((row) => [row.filename, row.checksum]));
}

function assertUnchanged(migrations: Migration[], applied: Map<string, string>): void {
  for (const migration of migrations) {
    const appliedChecksum = applied.get(migration.filename);
    if (appliedChecksum !== undefined && appliedChecksum !== migration.checksum) {
      throw new Error(
        `${migration.filename} has changed since it was applied. ` +
          'Applied migrations are immutable — add a new migration instead.',
      );
    }
  }
}

export async function status(): Promise<void> {
  await ensureMigrationsTable();
  const [migrations, applied] = await Promise.all([loadMigrations(), loadApplied()]);
  assertUnchanged(migrations, applied);

  if (migrations.length === 0) {
    console.log('No migrations found.');
    return;
  }

  for (const migration of migrations) {
    const mark = applied.has(migration.filename) ? 'applied' : 'pending';
    console.log(`  [${mark}] ${migration.filename}`);
  }
}

export async function migrate(): Promise<void> {
  await ensureMigrationsTable();
  const [migrations, applied] = await Promise.all([loadMigrations(), loadApplied()]);
  assertUnchanged(migrations, applied);

  const pending = migrations.filter((m) => !applied.has(m.filename));
  if (pending.length === 0) {
    console.log('Database is up to date.');
    return;
  }

  const client = await getPool().connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY.toString()]);

    for (const migration of pending) {
      console.log(`Applying ${migration.filename} ...`);
      // Same connection that holds the advisory lock, so the DDL and its
      // bookkeeping row commit together. PostgreSQL DDL is transactional.
      try {
        await client.query('BEGIN');
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
          [migration.filename, migration.checksum],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`${migration.filename} failed to apply`, { cause: error });
      }
    }

    console.log(`Applied ${pending.length} migration(s).`);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY.toString()]);
    client.release();
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'up';
  switch (command) {
    case 'up':
      await migrate();
      break;
    case 'status':
      await status();
      break;
    default:
      console.error(`Unknown command "${command}". Expected "up" or "status".`);
      process.exitCode = 1;
  }
}

// Only run as a CLI; importing this module should not touch the database.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(closePool);
}
