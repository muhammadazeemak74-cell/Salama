/**
 * The Express application: middleware, routes, static delivery, errors.
 *
 * No listening or process concerns here, so tests can import it directly.
 */

import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { config } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { videoRouter } from './routes/video.js';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: false,
      // Videos are fetched cross-origin by the app and any CDN in front of it.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      maxAge: 86_400,
    }),
  );

  // Only the metadata endpoints take JSON; render-promo is multipart and is
  // parsed by multer inside the router.
  app.use(express.json({ limit: '64kb' }));

  /**
   * Rendered MP4s, served straight off disk. This is the local-development
   * stand-in for object storage plus a CDN — in production PUBLIC_BASE_URL
   * points at the CDN and this route stops being the hot path.
   */
  app.use(
    '/media/renders',
    express.static(config.storage.renders, {
      index: false,
      // Names are UUIDs, so a rendered file at a given URL never changes.
      immutable: true,
      maxAge: '7d',
      // Do not let a request for a missing file fall through to the SPA-ish
      // 404 handler with a half-written response.
      fallthrough: true,
    }),
  );

  app.use('/api/v1/media', videoRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
