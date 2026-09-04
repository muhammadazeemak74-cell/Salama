/**
 * The Express application: middleware, routes, error handling.
 *
 * Kept free of any listening or process concerns so it can be imported
 * directly by tests. `index.ts` owns the server lifecycle.
 */

import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';

import { config } from './config.ts';
import { errorHandler, notFoundHandler } from './middleware/error.ts';
import { authRouter } from './routes/auth.ts';
import { healthRouter } from './routes/health.ts';
import { productsRouter } from './routes/products.ts';

export function createApp(): Express {
  const app = express();

  // Behind Vercel / a load balancer, so req.ip and req.protocol should come
  // from X-Forwarded-*. 'loopback' trusts only the proxy on the same host.
  app.set('trust proxy', 'loopback');

  // No templating here, and the version header only helps an attacker.
  app.disable('x-powered-by');
  app.disable('etag');

  app.use(
    helmet({
      // A JSON API is never framed and never loads its own resources; the
      // default CSP is noise on responses no browser renders.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  app.use(
    cors({
      // Empty allowlist reflects the request origin. Native Flutter clients
      // send no Origin header at all, so they are unaffected either way.
      origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      maxAge: 86_400,
    }),
  );

  app.use(express.json({ limit: config.jsonBodyLimit }));

  // Unversioned on purpose: infrastructure probes it, not the app.
  app.use(healthRouter);

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/products', productsRouter);

  // Order matters: 404 for unmatched routes, then the single error handler.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
