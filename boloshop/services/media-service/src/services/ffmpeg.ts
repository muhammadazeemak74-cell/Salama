/**
 * The promo-video render pipeline.
 *
 * Takes up to three product photos and turns them into a 15-second 1080x1920
 * MP4: a Ken Burns move across each photo, then the product title, the price
 * in PKR, and a BoloShop badge drawn on top.
 *
 * FFmpeg is driven directly through `child_process.spawn` rather than through
 * fluent-ffmpeg. The filtergraph here is a hand-built `-filter_complex` with
 * per-input zoompan chains and a concat, which is exactly the shape fluent's
 * builder gets in the way of — and spawning argv with no shell means a product
 * title can never reach a command line.
 */

import { spawn } from 'node:child_process';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { config } from '../config.js';

// ---------------------------------------------------------------------------
// Binary probing
// ---------------------------------------------------------------------------

export interface FfmpegStatus {
  available: boolean;
  binary: string;
  version?: string;
  error?: string;
  /** drawtext needs a real font file; without one no overlay can be drawn. */
  fontPath?: string;
  fontAvailable: boolean;
  fontError?: string;
}

let cachedStatus: { at: number; status: FfmpegStatus } | undefined;

function runVersion(binary: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(binary, ['-hide_banner', '-version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ code: null, stdout: '', stderr: error instanceof Error ? error.message : String(error) });
      return;
    }

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    // ENOENT lands here when the binary is not on PATH.
    child.on('error', (error: Error) => resolve({ code: null, stdout, stderr: error.message }));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

/**
 * Is FFmpeg usable on this host? Cached briefly so a health check that gets
 * polled every second does not fork a process every second.
 */
export async function probeFfmpeg(options: { force?: boolean } = {}): Promise<FfmpegStatus> {
  const now = Date.now();
  if (!options.force && cachedStatus && now - cachedStatus.at < config.ffmpeg.probeCacheMs) {
    return cachedStatus.status;
  }

  const { code, stdout, stderr } = await runVersion(config.ffmpeg.binary);
  const fontPath = config.ffmpeg.fontPath;

  const fontError = fontPath !== undefined
    ? undefined
    : config.ffmpeg.fontPathConfigured !== undefined
      ? `FONT_PATH is set to "${config.ffmpeg.fontPathConfigured}" but no file exists there.`
      : 'No font file found in any of the standard locations. Set FONT_PATH.';

  const status: FfmpegStatus = code === 0
    ? {
        available: true,
        binary: config.ffmpeg.binary,
        version: stdout.split('\n')[0]?.trim() ?? 'unknown',
        fontAvailable: fontPath !== undefined,
        ...(fontPath ? { fontPath } : {}),
        ...(fontError ? { fontError } : {}),
      }
    : {
        available: false,
        binary: config.ffmpeg.binary,
        error: stderr.trim() || `exited with code ${code}`,
        fontAvailable: fontPath !== undefined,
        ...(fontPath ? { fontPath } : {}),
        ...(fontError ? { fontError } : {}),
      };

  cachedStatus = { at: now, status };
  return status;
}

/** Drop the cached probe, so the next check re-runs the binary. */
export function resetFfmpegProbeCache(): void {
  cachedStatus = undefined;
}

// ---------------------------------------------------------------------------
// Text preparation
// ---------------------------------------------------------------------------

/**
 * Format a PKR amount for display: "4499.50" -> "Rs 4,499.50", "4499.00" ->
 * "Rs 4,499". Works on the string straight from the database, so no amount is
 * ever routed through a float on its way to the screen.
 */
export function formatPkr(amount: string): string {
  const [wholePart = '0', fraction] = amount.split('.');
  const grouped = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const showFraction = fraction !== undefined && Number.parseInt(fraction.padEnd(2, '0'), 10) > 0;
  return showFraction ? `Rs ${grouped}.${fraction.padEnd(2, '0')}` : `Rs ${grouped}`;
}

/**
 * Break a title across at most `maxLines` lines of roughly `maxCharsPerLine`,
 * ellipsising what does not fit. drawtext does no wrapping of its own, and a
 * long title would otherwise run off both edges of the frame.
 */
export function wrapTitle(title: string, maxCharsPerLine = 24, maxLines = 2): string {
  const words = title.trim().split(/\s+/).filter((word) => word !== '');
  if (words.length === 0) return '';

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }
    if (current !== '') lines.push(current);
    if (lines.length === maxLines) break;
    // A single word longer than the line gets hard-cut rather than overflowing.
    current = word.length > maxCharsPerLine ? `${word.slice(0, maxCharsPerLine - 1)}…` : word;
  }

  if (current !== '' && lines.length < maxLines) lines.push(current);

  const dropped = words.join(' ').length > lines.join(' ').length;
  if (dropped && lines.length > 0) {
    const last = lines[lines.length - 1] as string;
    lines[lines.length - 1] = last.endsWith('…')
      ? last
      : `${last.slice(0, Math.max(0, maxCharsPerLine - 1))}…`;
  }

  return lines.join('\n');
}

/**
 * Quote a value for a filter option.
 *
 * Wrapping in single quotes makes colons, commas and brackets literal, which
 * matters for filesystem paths. Only backslashes and single quotes then need
 * handling. Overlay *text* never goes through here — it is passed via
 * `textfile=` so arbitrary product titles need no escaping at all.
 */
export function quoteFilterValue(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "'\\''")}'`;
}

// ---------------------------------------------------------------------------
// Filtergraph
// ---------------------------------------------------------------------------

export interface FilterGraphPaths {
  fontPath: string;
  titleFile: string;
  priceFile: string;
}

/**
 * Frames per image, summing to exactly `durationSeconds * fps`. Any rounding
 * remainder goes to the last image so the video is exactly 15 seconds.
 */
export function framesPerImage(imageCount: number): number[] {
  const total = config.video.durationSeconds * config.video.fps;
  const base = Math.floor(total / imageCount);
  const frames = Array.from({ length: imageCount }, () => base);
  frames[imageCount - 1] = total - base * (imageCount - 1);
  return frames;
}

/**
 * Build the `-filter_complex` graph.
 *
 * Per image: cover-crop to 2x the output size, then zoompan. The upscale is
 * what makes the move smooth — zoompan positions on integer input pixels, so
 * panning a 1080-wide source steps visibly, while a 2160-wide one does not.
 * Direction alternates (in, out, in) so a three-photo promo does not look like
 * the same move three times.
 */
export function buildFilterGraph(imageCount: number, paths: FilterGraphPaths): string {
  const { width, height, fps } = config.video;
  const workWidth = width * 2;
  const workHeight = height * 2;
  const maxZoom = 1.2;

  const frames = framesPerImage(imageCount);
  const chains: string[] = [];

  frames.forEach((frameCount, index) => {
    const step = (maxZoom - 1) / frameCount;
    const zoomIn = index % 2 === 0;
    // zoompan evaluates `z` per output frame; `on` is the output frame index,
    // so frame 0 seeds the starting zoom and every later frame steps from it.
    const zoomExpr = zoomIn
      ? `min(zoom+${step.toFixed(6)},${maxZoom})`
      : `if(eq(on,0),${maxZoom},max(zoom-${step.toFixed(6)},1.0))`;

    // The input label abuts the first filter — a comma after it would read
    // as an empty filter name.
    chains.push(
      `[${index}:v]` +
      [
        `scale=${workWidth}:${workHeight}:force_original_aspect_ratio=increase`,
        `crop=${workWidth}:${workHeight}`,
        `zoompan=z='${zoomExpr}':d=${frameCount}` +
          `:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'` +
          `:s=${width}x${height}:fps=${fps}`,
        `setsar=1[v${index}]`,
      ].join(','),
    );
  });

  const concatInputs = frames.map((_, index) => `[v${index}]`).join('');
  chains.push(`${concatInputs}concat=n=${imageCount}:v=1:a=0[stitched]`);

  const font = quoteFilterValue(paths.fontPath);
  const fadeOutStart = (config.video.durationSeconds - 0.4).toFixed(2);

  chains.push(
    '[stitched]' +
    [
      // Scrim behind the copy: white text over an unknown photo is a coin flip.
      `drawbox=x=0:y=${height - 470}:w=${width}:h=470:color=black@0.55:t=fill`,
      `drawtext=fontfile=${font}:textfile=${quoteFilterValue(paths.titleFile)}` +
        `:fontcolor=white:fontsize=62:line_spacing=14:x=(w-text_w)/2:y=h-410`,
      `drawtext=fontfile=${font}:textfile=${quoteFilterValue(paths.priceFile)}` +
        `:fontcolor=black:fontsize=88:box=1:boxcolor=0xFFD400@0.95:boxborderw=26` +
        `:x=(w-text_w)/2:y=h-215`,
      // Watermark badge. drawtext sizes its own box, so no width maths.
      `drawtext=fontfile=${font}:text='BoloShop'` +
        `:fontcolor=white:fontsize=44:box=1:boxcolor=0x0F766E@0.9:boxborderw=22:x=56:y=76`,
      'fade=t=in:st=0:d=0.4',
      `fade=t=out:st=${fadeOutStart}:d=0.4`,
      'format=yuv420p[out]',
    ].join(','),
  );

  return chains.join(';');
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export interface RenderRequest {
  imagePaths: string[];
  title: string;
  pricePkr: string;
  outputPath: string;
  /** Scratch directory for the overlay text files. */
  workDir: string;
}

export interface RenderResult {
  outputPath: string;
  width: number;
  height: number;
  durationSeconds: number;
  bytes: number;
  renderMs: number;
}

export class FfmpegRenderError extends Error {
  /** The tail of FFmpeg's stderr — the only place it says what went wrong. */
  readonly stderrTail: string;

  constructor(message: string, stderrTail: string) {
    super(message);
    this.name = 'FfmpegRenderError';
    this.stderrTail = stderrTail;
  }
}

export class FfmpegUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FfmpegUnavailableError';
  }
}

export function buildRenderArgs(request: RenderRequest, paths: FilterGraphPaths): string[] {
  const { width, height, fps, durationSeconds, crf, preset } = config.video;

  const args = ['-hide_banner', '-loglevel', 'error', '-y'];

  // One still per input. zoompan turns each single frame into its own run of
  // frames, so the inputs are deliberately NOT looped.
  for (const imagePath of request.imagePaths) {
    args.push('-i', imagePath);
  }

  args.push(
    '-filter_complex', buildFilterGraph(request.imagePaths.length, paths),
    '-map', '[out]',
    '-an',
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-level', '4.1',
    '-preset', preset,
    '-crf', crf.toString(),
    '-r', fps.toString(),
    '-t', durationSeconds.toString(),
    // Moves the moov atom to the front so playback starts before the whole
    // file arrives — the difference between usable and not on a 3G link.
    '-movflags', '+faststart',
    '-s', `${width}x${height}`,
    request.outputPath,
  );

  return args;
}

/** Render a promo. Rejects if FFmpeg is missing, fails, or runs too long. */
export async function renderPromoVideo(request: RenderRequest): Promise<RenderResult> {
  const status = await probeFfmpeg();
  if (!status.available) {
    throw new FfmpegUnavailableError(
      `FFmpeg binary "${config.ffmpeg.binary}" is not available on this host.`,
    );
  }
  if (!status.fontPath) {
    throw new FfmpegUnavailableError(
      'No font file found for text overlays. Set FONT_PATH to a .ttf on this host.',
    );
  }

  await mkdir(request.workDir, { recursive: true });

  // Overlay copy goes through files, not the command line: a product title is
  // user input, and textfile= means it needs no filter escaping whatsoever.
  const paths: FilterGraphPaths = {
    fontPath: status.fontPath,
    titleFile: join(request.workDir, 'title.txt'),
    priceFile: join(request.workDir, 'price.txt'),
  };
  await writeFile(paths.titleFile, wrapTitle(request.title), 'utf8');
  await writeFile(paths.priceFile, formatPkr(request.pricePkr), 'utf8');

  const args = buildRenderArgs(request, paths);
  const startedAt = Date.now();

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(config.ffmpeg.binary, args, { stdio: ['ignore', 'ignore', 'pipe'] });

      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
        // Keep the tail only; a failing filtergraph can produce a lot of it.
        if (stderr.length > 8_000) stderr = stderr.slice(-8_000);
      });

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new FfmpegRenderError(
          `Render exceeded ${config.ffmpeg.timeoutMs}ms and was killed.`,
          stderr.trim(),
        ));
      }, config.ffmpeg.timeoutMs);

      child.on('error', (error: Error) => {
        clearTimeout(timer);
        reject(new FfmpegUnavailableError(error.message));
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve();
          return;
        }
        reject(new FfmpegRenderError(`FFmpeg exited with code ${code}.`, stderr.trim()));
      });
    });
  } finally {
    // The text files are scratch either way.
    await rm(request.workDir, { recursive: true, force: true });
  }

  const { size } = await stat(request.outputPath);

  return {
    outputPath: request.outputPath,
    width: config.video.width,
    height: config.video.height,
    durationSeconds: config.video.durationSeconds,
    bytes: size,
    renderMs: Date.now() - startedAt,
  };
}
