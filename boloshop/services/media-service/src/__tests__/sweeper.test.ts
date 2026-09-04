import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ensureStorage, type StoragePaths } from '../services/storage.ts';
import { startSweeper, sweepStorage, type SweepOptions } from '../services/sweeper.ts';

const HOUR_MS = 60 * 60 * 1000;

let root: string;
let paths: StoragePaths;

const options = (overrides: Partial<SweepOptions> = {}): SweepOptions => ({
  renderTtlMs: 24 * HOUR_MS,
  scratchTtlMs: HOUR_MS,
  ...overrides,
});

/** Backdates a file or directory so a TTL applies to it. */
async function age(path: string, hours: number): Promise<void> {
  const when = new Date(Date.now() - hours * HOUR_MS);
  await utimes(path, when, when);
}

async function writeRender(name: string, bytes = 8): Promise<string> {
  const path = join(paths.renders, name);
  await writeFile(path, 'v'.repeat(bytes));
  return path;
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'boloshop-sweep-'));
  paths = {
    root,
    incoming: join(root, 'incoming'),
    renders: join(root, 'renders'),
  };
  await ensureStorage(paths);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('sweepStorage', () => {
  it('deletes a render past its TTL', async () => {
    const old = await writeRender('old.mp4');
    await age(old, 30);

    const result = await sweepStorage(paths, options());

    expect(existsSync(old)).toBe(false);
    expect(result.rendersDeleted).toBe(1);
  });

  it('keeps a render inside its TTL', async () => {
    // The seller is most likely fetching this one right now.
    const fresh = await writeRender('fresh.mp4');
    await age(fresh, 2);

    const result = await sweepStorage(paths, options());

    expect(existsSync(fresh)).toBe(true);
    expect(result.rendersDeleted).toBe(0);
  });

  it('reports the bytes it reclaimed', async () => {
    const old = await writeRender('old.mp4', 4096);
    await age(old, 30);

    const result = await sweepStorage(paths, options());

    expect(result.bytesReclaimed).toBe(4096);
  });

  it('deletes scratch a crashed render left behind', async () => {
    // ensureStorage clears incoming/ at boot, which covers a restart. This is
    // the process that stays up while a render dies without its own cleanup.
    const workDir = join(paths.incoming, 'work-3aff3bf4');
    await mkdir(workDir, { recursive: true });
    await writeFile(join(workDir, 'title.txt'), 'Lawn Suit');
    const upload = join(paths.incoming, 'orphan.jpg');
    await writeFile(upload, 'x');
    await age(workDir, 3);
    await age(upload, 3);

    const result = await sweepStorage(paths, options());

    expect(await readdir(paths.incoming)).toEqual([]);
    expect(result.scratchDeleted).toBe(2);
  });

  it('leaves scratch belonging to a render still in flight', async () => {
    const workDir = join(paths.incoming, 'work-live');
    await mkdir(workDir, { recursive: true });

    await sweepStorage(paths, options());

    expect(existsSync(workDir)).toBe(true);
  });

  it('keeps everything when the TTLs are zero', async () => {
    const old = await writeRender('old.mp4');
    await age(old, 500);
    const scratch = join(paths.incoming, 'stale.jpg');
    await writeFile(scratch, 'x');
    await age(scratch, 500);

    const result = await sweepStorage(
      paths,
      options({ renderTtlMs: 0, scratchTtlMs: 0 }),
    );

    expect(existsSync(old)).toBe(true);
    expect(existsSync(scratch)).toBe(true);
    expect(result.rendersDeleted).toBe(0);
    expect(result.scratchDeleted).toBe(0);
  });

  it('does not touch renders when sweeping scratch', async () => {
    // The MP4s are what a seller spent a credit on; only the TTL may take one.
    const keep = await writeRender('paid-for.mp4');
    const scratch = join(paths.incoming, 'stale.jpg');
    await writeFile(scratch, 'x');
    await age(scratch, 3);

    await sweepStorage(paths, options());

    expect(existsSync(keep)).toBe(true);
  });

  it('survives a directory that does not exist yet', async () => {
    // The first pass runs before the first render on a fresh host.
    await rm(paths.renders, { recursive: true, force: true });

    const result = await sweepStorage(paths, options());

    expect(result.failures).toBe(0);
    expect(result.rendersDeleted).toBe(0);
  });

  describe('byte cap', () => {
    it('drops the oldest renders until the directory is under it', async () => {
      const oldest = await writeRender('a.mp4', 1000);
      const middle = await writeRender('b.mp4', 1000);
      const newest = await writeRender('c.mp4', 1000);
      await age(oldest, 5);
      await age(middle, 3);
      await age(newest, 1);

      const result = await sweepStorage(
        paths,
        options({ maxRenderBytes: 2000 }),
      );

      expect(existsSync(oldest)).toBe(false);
      expect(existsSync(middle)).toBe(true);
      expect(existsSync(newest)).toBe(true);
      expect(result.rendersDeleted).toBe(1);
    });

    it('is off by default, whatever the directory holds', async () => {
      await writeRender('a.mp4', 5000);
      await writeRender('b.mp4', 5000);

      const result = await sweepStorage(paths, options());

      expect(result.rendersDeleted).toBe(0);
    });

    it('does not count renders the TTL already took', async () => {
      // Otherwise a TTL sweep that already freed the space would still go on
      // to delete live renders to meet the cap.
      const expired = await writeRender('expired.mp4', 5000);
      await age(expired, 30);
      const fresh = await writeRender('fresh.mp4', 1000);

      await sweepStorage(paths, options({ maxRenderBytes: 2000 }));

      expect(existsSync(expired)).toBe(false);
      expect(existsSync(fresh)).toBe(true);
    });
  });
});

describe('startSweeper', () => {
  it('sweeps once immediately', async () => {
    const old = await writeRender('old.mp4');
    await age(old, 30);

    const swept = new Promise<void>((resolve) => {
      const stop = startSweeper(paths, { ...options(), intervalMs: HOUR_MS }, () => {
        stop();
        resolve();
      });
    });

    await swept;
    expect(existsSync(old)).toBe(false);
  });

  it('schedules a repeating pass and stops it on request', async () => {
    // The passes are async against the real filesystem, so this asserts the
    // schedule rather than trying to count completions through fake timers.
    jest.useFakeTimers();
    try {
      const stop = startSweeper(paths, { ...options(), intervalMs: 60_000 });

      expect(jest.getTimerCount()).toBe(1);

      stop();

      // A timer left running would keep sweeping a directory the process no
      // longer owns, and hold a test worker open.
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does nothing and returns a no-op stopper when switched off', async () => {
    const old = await writeRender('old.mp4');
    await age(old, 500);

    const stop = startSweeper(paths, { ...options(), intervalMs: 0 });
    stop();

    expect(existsSync(old)).toBe(true);
  });
});
