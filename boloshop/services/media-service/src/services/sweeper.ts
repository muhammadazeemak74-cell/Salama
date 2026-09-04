/**
 * Ephemeral disk sweeper.
 *
 * `renders/` grows on every completed job and nothing has ever removed from
 * it. The job record that names an MP4 is in-memory and evicted an hour after
 * it finishes, and lost entirely on restart — so a file whose job is gone can
 * no longer be polled for, but the bytes stay on the volume until it fills.
 * On a Fly volume or a compose named volume, that is a service that works for
 * weeks and then stops accepting renders with ENOSPC.
 *
 * Two rules, both by modification time:
 *
 *   renders/   deleted once older than the render TTL. A promo is fetched by
 *              the seller in the minutes after it renders; a day is generous.
 *   incoming/  deleted once older than the scratch TTL. `ensureStorage` clears
 *              this at boot, which covers a restart; this covers the process
 *              that stays up while a render dies badly enough to skip its own
 *              cleanup.
 *
 * Both TTLs are floored well above the render timeout in config.ts, because a
 * work directory's mtime stops moving while FFmpeg encodes — a TTL shorter
 * than a render could delete the drawtext files out from under a job that is
 * still running.
 */

import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { config } from '../config.ts';
import type { StoragePaths } from './storage.ts';

export interface SweepOptions {
  /** Delete finished renders older than this. 0 or less keeps them forever. */
  renderTtlMs: number;
  /** Delete leftover uploads and scratch older than this. 0 or less disables. */
  scratchTtlMs: number;
  /**
   * After the TTL pass, delete the oldest renders until the directory is under
   * this many bytes. 0 or less means no cap.
   *
   * Off by default: throwing away a render a seller spent a credit on because
   * the disk is busy is a product decision, not a default.
   */
  maxRenderBytes?: number;
}

export interface SweepResult {
  rendersDeleted: number;
  scratchDeleted: number;
  bytesReclaimed: number;
  /** Entries that could not be read or removed. Logged, never thrown. */
  failures: number;
}

interface Entry {
  path: string;
  modifiedMs: number;
  bytes: number;
}

/**
 * Files and directories directly under `dir`, with their size and mtime.
 *
 * A directory's size is the sum of what is under it, so the byte cap counts a
 * scratch directory honestly. A missing directory reads as empty: the sweeper
 * runs before the first render on a fresh host.
 */
async function entriesOf(dir: string): Promise<{ entries: Entry[]; failures: number }> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return { entries: [], failures: 0 };
  }

  const entries: Entry[] = [];
  let failures = 0;

  for (const name of names) {
    const path = join(dir, name);
    try {
      const stats = await stat(path);
      entries.push({
        path,
        modifiedMs: stats.mtimeMs,
        bytes: stats.isDirectory() ? await bytesUnder(path) : stats.size,
      });
    } catch {
      // Raced with the render path deleting its own scratch, most likely.
      // Nothing to sweep either way.
      failures += 1;
    }
  }

  return { entries, failures };
}

async function bytesUnder(dir: string): Promise<number> {
  let total = 0;
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return 0;
  }

  for (const name of names) {
    const path = join(dir, name);
    try {
      const stats = await stat(path);
      total += stats.isDirectory() ? await bytesUnder(path) : stats.size;
    } catch {
      // Gone mid-walk; it contributes nothing.
    }
  }
  return total;
}

async function remove(entry: Entry): Promise<boolean> {
  try {
    await rm(entry.path, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * One pass. Never throws: a sweeper that takes the process down with it when a
 * file is busy is worse than a full disk.
 */
export async function sweepStorage(
  paths: StoragePaths,
  options: SweepOptions,
): Promise<SweepResult> {
  const now = Date.now();
  const result: SweepResult = {
    rendersDeleted: 0,
    scratchDeleted: 0,
    bytesReclaimed: 0,
    failures: 0,
  };

  const renders = await entriesOf(paths.renders);
  const scratch = await entriesOf(paths.incoming);
  result.failures += renders.failures + scratch.failures;

  const survivors: Entry[] = [];

  if (options.renderTtlMs > 0) {
    for (const entry of renders.entries) {
      if (now - entry.modifiedMs <= options.renderTtlMs) {
        survivors.push(entry);
        continue;
      }
      if (await remove(entry)) {
        result.rendersDeleted += 1;
        result.bytesReclaimed += entry.bytes;
      } else {
        result.failures += 1;
      }
    }
  } else {
    survivors.push(...renders.entries);
  }

  if (options.scratchTtlMs > 0) {
    for (const entry of scratch.entries) {
      if (now - entry.modifiedMs <= options.scratchTtlMs) continue;
      if (await remove(entry)) {
        result.scratchDeleted += 1;
        result.bytesReclaimed += entry.bytes;
      } else {
        result.failures += 1;
      }
    }
  }

  const cap = options.maxRenderBytes ?? 0;
  if (cap > 0) {
    let total = survivors.reduce((sum, entry) => sum + entry.bytes, 0);
    // Oldest first: the ones least likely to still be being fetched.
    survivors.sort((a, b) => a.modifiedMs - b.modifiedMs);

    for (const entry of survivors) {
      if (total <= cap) break;
      if (await remove(entry)) {
        result.rendersDeleted += 1;
        result.bytesReclaimed += entry.bytes;
        total -= entry.bytes;
      } else {
        result.failures += 1;
      }
    }
  }

  return result;
}

/** Stops the interval started by [startSweeper]. */
export type StopSweeper = () => void;

/**
 * Run [sweepStorage] on an interval, starting with one pass now.
 *
 * The timer is unref'd, so it never holds the process open on its own — a
 * shutdown waits for the HTTP server, not for the next sweep. Returns a no-op
 * stopper when sweeping is switched off, so callers need no special case.
 */
export function startSweeper(
  paths: StoragePaths = config.storage,
  options: SweepOptions & { intervalMs: number } = config.sweeper,
  log: (result: SweepResult) => void = defaultLog,
): StopSweeper {
  if (options.intervalMs <= 0) {
    console.info('[media-service] disk sweeper disabled (MEDIA_SWEEP_INTERVAL_MINUTES=0)');
    return () => undefined;
  }

  const pass = (): void => {
    void sweepStorage(paths, options).then(log, (error: unknown) => {
      console.warn(`[media-service] sweep failed: ${String(error)}`);
    });
  };

  pass();

  const timer = setInterval(pass, options.intervalMs);
  timer.unref();

  return () => clearInterval(timer);
}

function defaultLog(result: SweepResult): void {
  // Silence when there was nothing to do: this runs every few minutes and a
  // log line each time buries everything else.
  if (result.rendersDeleted === 0 && result.scratchDeleted === 0) {
    if (result.failures > 0) {
      console.warn(`[media-service] sweep: ${result.failures} entr(ies) could not be swept`);
    }
    return;
  }

  const mb = (result.bytesReclaimed / (1024 * 1024)).toFixed(1);
  console.info(
    `[media-service] sweep: ${result.rendersDeleted} render(s), ` +
      `${result.scratchDeleted} scratch entr(ies), ${mb} MB reclaimed` +
      (result.failures > 0 ? `, ${result.failures} failed` : ''),
  );
}
