/**
 * Centralized error handling: the last two middlewares on the app.
 *
 * Every failure leaves this service as the same JSON shape, so the Flutter
 * client has exactly one error branch to write.
 */

import type { NextFunction, Request, Response } from 'express';

import { config } from '../config.js';
import { HttpError, type ErrorBody } from '../errors.js';

/** 404 for anything no route claimed. Mount after all routes. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(HttpError.notFound(`No route for ${req.method} ${req.path}.`));
}

/**
 * The error handler. Express identifies it by its four-argument signature, so
 * `next` must stay even though it is unused on the happy path.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Headers already flushed: the response is committed, so hand back to
  // Express to tear the connection down.
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    const body: ErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    };
    res.status(error.status).json(body);
    return;
  }

  // A malformed JSON body surfaces as a SyntaxError from express.json().
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: { code: 'invalid_json', message: 'Request body is not valid JSON.' },
    } satisfies ErrorBody);
    return;
  }

  // Anything else is a bug. Log it in full, tell the caller nothing.
  console.error('[api-gateway] unhandled error', {
    method: req.method,
    path: req.path,
    error,
  });

  res.status(500).json({
    error: {
      code: 'internal_error',
      message: config.isProduction
        ? 'Something went wrong. Please try again.'
        : error instanceof Error
          ? error.message
          : String(error),
    },
  } satisfies ErrorBody);
}
