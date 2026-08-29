/**
 * Centralized error handling: the last two middlewares on the app.
 */

import type { NextFunction, Request, Response } from 'express';

import { config } from '../config.js';
import { HttpError, type ErrorBody } from '../errors.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(HttpError.notFound(`No route for ${req.method} ${req.path}.`));
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    } satisfies ErrorBody);
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: { code: 'invalid_json', message: 'Request body is not valid JSON.' },
    } satisfies ErrorBody);
    return;
  }

  console.error('[media-service] unhandled error', {
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
