/**
 * Promo video rendering.
 *
 *   POST /api/v1/media/render-promo   multipart: up to 3 photos + metadata
 *   GET  /api/v1/media/jobs/:id       poll a render
 *   GET  /api/v1/media/health         service + FFmpeg binary status
 */

import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { Router, type NextFunction, type Request, type Response } from 'express';
import { ping, pingRedis } from '@boloshop/db';
import multer from 'multer';
import { z } from 'zod';

import { config } from '../config.ts';
import { HttpError } from '../errors.ts';
import {
  FfmpegRenderError,
  FfmpegUnavailableError,
  probeFfmpeg,
  renderPromoVideo,
} from '../services/ffmpeg.ts';
import {
  InsufficientCreditsError,
  deduct,
  findSeller,
  getBalance,
  refund,
} from '../services/credits.ts';
import { createJob, getJob, markCompleted, markFailed, markRendering } from '../services/jobs.ts';
import { discardFiles } from '../services/storage.ts';
import { parseOrThrow, pkrAmountSchema } from '../validation.ts';

export const videoRouter: Router = Router();

const startedAt = Date.now();

// ---------------------------------------------------------------------------
// Upload handling
// ---------------------------------------------------------------------------

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, done) => done(null, config.storage.incoming),
    filename: (_req, file, done) => {
      // Never reuse the client's filename: it is attacker-controlled and ends
      // up as an argv entry to FFmpeg.
      const extension = EXTENSION_BY_MIME[file.mimetype] ?? extname(file.originalname) ?? '.bin';
      done(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: {
    fileSize: config.upload.maxBytesPerImage,
    files: config.upload.maxImages,
    // Only the three metadata fields below are expected.
    fields: 8,
  },
  fileFilter: (_req, file, done) => {
    const accepted: readonly string[] = config.upload.acceptedMimeTypes;
    if (!accepted.includes(file.mimetype)) {
      done(new HttpError(
        415,
        'unsupported_media_type',
        `Unsupported image type "${file.mimetype}". Send ${config.upload.acceptedMimeTypes.join(', ')}.`,
      ));
      return;
    }
    done(null, true);
  },
});

/** Turn multer's own errors into this service's error shape. */
function acceptImages(req: Request, res: Response, next: NextFunction): void {
  upload.array('images', config.upload.maxImages)(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      switch (error.code) {
        case 'LIMIT_FILE_SIZE':
          next(HttpError.payloadTooLarge(
            `Each image must be under ${Math.floor(config.upload.maxBytesPerImage / (1024 * 1024))}MB.`,
          ));
          return;
        case 'LIMIT_FILE_COUNT':
        case 'LIMIT_UNEXPECTED_FILE':
          next(HttpError.badRequest(
            `Send at most ${config.upload.maxImages} images, all under the field name "images".`,
          ));
          return;
        default:
          next(HttpError.badRequest(`Upload rejected: ${error.message}.`));
          return;
      }
    }

    next(error);
  });
}

async function discardUploads(files: Express.Multer.File[]): Promise<void> {
  await discardFiles(files.map((file) => file.path));
}

// ---------------------------------------------------------------------------
// POST /render-promo
// ---------------------------------------------------------------------------

const renderPromoSchema = z.object({
  seller_id: z.uuid('seller_id must be a UUID.'),
  title: z.string().trim().min(1).max(200),
  price_pkr: pkrAmountSchema,
});

function publicVideoUrl(fileName: string): string {
  const path = `/media/renders/${fileName}`;
  return config.publicBaseUrl === '' ? path : `${config.publicBaseUrl}${path}`;
}

videoRouter.post('/render-promo', acceptImages, async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];

  // Everything below this point must clean the uploads up before it throws.
  try {
    if (files.length === 0) {
      throw HttpError.badRequest('Attach 1–3 product photos under the field name "images".');
    }

    const input = parseOrThrow(renderPromoSchema, req.body);

    // Check the binary before spending a credit: no point charging for a
    // render this host cannot perform.
    const ffmpeg = await probeFfmpeg();
    if (!ffmpeg.available) {
      throw HttpError.ffmpegUnavailable(
        `Video rendering is unavailable: the FFmpeg binary "${ffmpeg.binary}" was not found on ` +
          'this host. Install FFmpeg or set FFMPEG_PATH.',
      );
    }
    if (!ffmpeg.fontAvailable) {
      throw HttpError.ffmpegUnavailable(
        `Video rendering is unavailable: ${ffmpeg.fontError ?? 'no overlay font is available.'} ` +
          'Set FONT_PATH to a .ttf on this host.',
      );
    }

    const seller = await findSeller(input.seller_id);
    if (!seller) throw HttpError.notFound(`No seller with id ${input.seller_id}.`);

    let remainingCredits: number;
    try {
      remainingCredits = await deduct(seller.id);
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        throw HttpError.paymentRequired(error.message);
      }
      throw error;
    }

    const job = createJob({
      sellerId: seller.id,
      title: input.title,
      pricePkr: input.price_pkr,
      imageCount: files.length,
    });

    const fileName = `${job.id}.mp4`;
    const outputPath = join(config.storage.renders, fileName);
    const imagePaths = files.map((file) => file.path);

    // Fire and forget: the response goes out now, the render continues.
    void (async () => {
      markRendering(job.id);
      try {
        const result = await renderPromoVideo({
          imagePaths,
          title: input.title,
          pricePkr: input.price_pkr,
          outputPath,
          workDir: join(config.storage.incoming, `work-${job.id}`),
        });

        markCompleted(job.id, {
          url: publicVideoUrl(fileName),
          width: result.width,
          height: result.height,
          duration_seconds: result.durationSeconds,
          bytes: result.bytes,
          render_ms: result.renderMs,
        });
        console.info('[media] render complete', { job: job.id, ms: result.renderMs });
      } catch (error) {
        // The seller should not pay for our failure.
        await refund(seller.id).catch((refundError: unknown) => {
          // A lost refund is a seller charged for a crash, so it is logged
          // loudly rather than swallowed with the render failure.
          console.error('[media] refund failed', { job: job.id, seller: seller.id, error: refundError });
        });

        if (error instanceof FfmpegUnavailableError) {
          markFailed(job.id, { code: 'ffmpeg_unavailable', message: error.message });
        } else if (error instanceof FfmpegRenderError) {
          markFailed(job.id, { code: 'render_failed', message: error.message });
          console.error('[media] render failed', { job: job.id, stderr: error.stderrTail });
        } else {
          markFailed(job.id, {
            code: 'render_failed',
            message: error instanceof Error ? error.message : String(error),
          });
          console.error('[media] render failed', { job: job.id, error });
        }

        await rm(outputPath, { force: true }).catch(() => undefined);
      } finally {
        await discardUploads(files);
      }
    })();

    res.status(202).json({
      job: {
        id: job.id,
        status: job.status,
        created_at: job.createdAt,
      },
      // Where the file will be once the job reports "completed". It is not
      // there yet — poll status_url rather than guessing at timing.
      video_url: publicVideoUrl(fileName),
      status_url: `/api/v1/media/jobs/${job.id}`,
      seller: { id: seller.id, store_name: seller.store_name },
      credits_remaining: remainingCredits,
    });
  } catch (error) {
    await discardUploads(files);
    throw error;
  }
});

// ---------------------------------------------------------------------------
// GET /jobs/:id
// ---------------------------------------------------------------------------

videoRouter.get('/jobs/:id', async (req, res) => {
  const job = getJob(req.params.id);
  if (!job) throw HttpError.notFound(`No render job with id ${req.params.id}.`);

  res.set('Cache-Control', 'no-store');
  res.json({
    job: {
      id: job.id,
      status: job.status,
      seller_id: job.sellerId,
      title: job.title,
      price_pkr: job.pricePkr,
      image_count: job.imageCount,
      created_at: job.createdAt,
      ...(job.startedAt ? { started_at: job.startedAt } : {}),
      ...(job.finishedAt ? { finished_at: job.finishedAt } : {}),
      ...(job.video ? { video: job.video } : {}),
      ...(job.error ? { error: job.error } : {}),
    },
    credits_remaining: await getBalance(job.sellerId),
  });
});

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

videoRouter.get('/health', async (_req, res) => {
  const [ffmpeg, databaseOk, redisOk] = await Promise.all([
    probeFfmpeg(),
    // Needed for the seller lookup on render-promo, but reported only —
    // rendering capability is what this endpoint's status code is about.
    ping().catch(() => false),
    // Redis holds the credit balances, so a render cannot be booked without
    // it. Reported for the same reason, and gating for the same one.
    pingRedis().catch(() => false),
  ]);

  // Degraded, not down: the service is up and answering, it just cannot render
  // until someone installs the binary. 503 tells a load balancer to route
  // elsewhere if another pod has it.
  const healthy = ffmpeg.available && ffmpeg.fontAvailable;

  res.set('Cache-Control', 'no-store');
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'media-service',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
    checks: {
      ffmpeg: {
        status: ffmpeg.available ? 'ok' : 'missing',
        binary: ffmpeg.binary,
        ...(ffmpeg.version ? { version: ffmpeg.version } : {}),
        ...(ffmpeg.error ? { error: ffmpeg.error } : {}),
      },
      font: {
        status: ffmpeg.fontAvailable ? 'ok' : 'missing',
        ...(ffmpeg.fontPath ? { path: ffmpeg.fontPath } : {}),
        ...(ffmpeg.fontError ? { error: ffmpeg.fontError } : {}),
      },
      database: { status: databaseOk ? 'ok' : 'error' },
      redis: { status: redisOk ? 'ok' : 'error' },
    },
    output: {
      width: config.video.width,
      height: config.video.height,
      duration_seconds: config.video.durationSeconds,
      fps: config.video.fps,
    },
  });
});
