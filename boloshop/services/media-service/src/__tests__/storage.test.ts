import { mkdtemp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  discardFiles,
  discardWorkDir,
  ensureStorage,
  type StoragePaths,
} from '../services/storage.ts';

let root: string;
let paths: StoragePaths;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'boloshop-storage-'));
  paths = {
    root,
    incoming: join(root, 'incoming'),
    renders: join(root, 'renders'),
  };
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('ensureStorage', () => {
  it('creates both directories on a fresh host', async () => {
    await ensureStorage(paths);

    expect(existsSync(paths.incoming)).toBe(true);
    expect(existsSync(paths.renders)).toBe(true);
  });

  it('creates nested directories that do not exist yet', async () => {
    const nested: StoragePaths = {
      root: join(root, 'a', 'b'),
      incoming: join(root, 'a', 'b', 'incoming'),
      renders: join(root, 'a', 'b', 'renders'),
    };

    await ensureStorage(nested);

    expect(existsSync(nested.incoming)).toBe(true);
    expect(existsSync(nested.renders)).toBe(true);
  });

  it('is safe to run twice', async () => {
    await ensureStorage(paths);
    await expect(ensureStorage(paths)).resolves.toBeUndefined();
  });

  it('sweeps scratch left by a render that was killed mid-flight', async () => {
    await ensureStorage(paths);

    // What a killed render leaves behind: the uploaded photos and the work
    // directory holding the drawtext files.
    await writeFile(join(paths.incoming, 'abandoned.jpg'), 'x');
    await mkdir(join(paths.incoming, 'work-a1b2'), { recursive: true });
    await writeFile(join(paths.incoming, 'work-a1b2', 'title.txt'), 'Lawn Suit');

    await ensureStorage(paths);

    expect(await readdir(paths.incoming)).toEqual([]);
  });

  it('never touches finished renders', async () => {
    // The MP4s are the product. Sweeping them would delete videos sellers paid
    // a credit for.
    await ensureStorage(paths);
    await writeFile(join(paths.renders, 'done.mp4'), 'video bytes');

    await ensureStorage(paths);

    expect(await readdir(paths.renders)).toEqual(['done.mp4']);
  });

  it('recreates incoming after sweeping it, so the next upload has somewhere to go', async () => {
    await ensureStorage(paths);
    await writeFile(join(paths.incoming, 'stale.jpg'), 'x');

    await ensureStorage(paths);

    const stats = await stat(paths.incoming);
    expect(stats.isDirectory()).toBe(true);
  });
});

describe('discardFiles', () => {
  it('removes every uploaded file it is given', async () => {
    await ensureStorage(paths);
    const uploads = [
      join(paths.incoming, 'a.jpg'),
      join(paths.incoming, 'b.png'),
      join(paths.incoming, 'c.webp'),
    ];
    await Promise.all(uploads.map((path) => writeFile(path, 'x')));

    await discardFiles(uploads);

    expect(await readdir(paths.incoming)).toEqual([]);
  });

  it('ignores a file that is already gone', async () => {
    // The render path calls this on every exit, including paths where an
    // earlier step already cleaned up. A second call must not throw.
    await ensureStorage(paths);
    const missing = join(paths.incoming, 'never-existed.jpg');

    await expect(discardFiles([missing])).resolves.toBeUndefined();
  });

  it('removes what it can when one path is bad', async () => {
    await ensureStorage(paths);
    const real = join(paths.incoming, 'real.jpg');
    await writeFile(real, 'x');

    await discardFiles([join(paths.incoming, 'ghost.jpg'), real]);

    expect(existsSync(real)).toBe(false);
  });

  it('does nothing when given nothing', async () => {
    await expect(discardFiles([])).resolves.toBeUndefined();
  });
});

describe('discardWorkDir', () => {
  it('removes the scratch directory and its contents', async () => {
    await ensureStorage(paths);
    const workDir = join(paths.incoming, 'work-3aff3bf4');
    await mkdir(workDir, { recursive: true });
    await writeFile(join(workDir, 'title.txt'), '3-Piece Lawn Suit');
    await writeFile(join(workDir, 'price.txt'), 'Rs 3,500');

    await discardWorkDir(workDir);

    expect(existsSync(workDir)).toBe(false);
  });

  it('ignores a directory that was never created', async () => {
    await ensureStorage(paths);

    await expect(discardWorkDir(join(paths.incoming, 'work-missing'))).resolves
      .toBeUndefined();
  });

  it('leaves sibling uploads alone', async () => {
    await ensureStorage(paths);
    const keep = join(paths.incoming, 'other.jpg');
    await writeFile(keep, 'x');
    const workDir = join(paths.incoming, 'work-1');
    await mkdir(workDir, { recursive: true });

    await discardWorkDir(workDir);

    expect(existsSync(keep)).toBe(true);
  });
});
