/**
 * Upload and render directories.
 *
 * `incoming/` holds only in-flight uploads and per-render scratch; the render
 * path deletes both when it finishes. `renders/` holds the finished MP4s and is
 * never swept — those are the product.
 */

import { mkdir, rm } from 'node:fs/promises';

import { config } from '../config.ts';

/** The directories this service reads and writes. */
export interface StoragePaths {
  root: string;
  incoming: string;
  renders: string;
}

/**
 * Create the storage directories, clearing the scratch one.
 *
 * Anything still in `incoming/` at boot belongs to a render this process was
 * killed in the middle of, so it is garbage — and on a busy host it is garbage
 * that accumulates until the disk fills. Renders are never resumed across a
 * restart, so nothing of value is lost.
 *
 * `paths` is injectable so this can be exercised against a temp directory
 * rather than whatever MEDIA_STORAGE_PATH happens to be.
 */
export async function ensureStorage(paths: StoragePaths = config.storage): Promise<void> {
  await rm(paths.incoming, { recursive: true, force: true });
  await mkdir(paths.incoming, { recursive: true });
  await mkdir(paths.renders, { recursive: true });
}

/**
 * Delete uploaded files, ignoring anything already gone.
 *
 * Called on every exit from the render path — success, validation failure,
 * insufficient credits, or a crashed FFmpeg — so a rejected request cannot
 * leave a 12MB photo behind.
 */
export async function discardFiles(paths: readonly string[]): Promise<void> {
  await Promise.all(
    paths.map((path) => rm(path, { force: true }).catch(() => undefined)),
  );
}

/** Delete a per-render scratch directory and everything under it. */
export async function discardWorkDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
}
