/**
 * The one error shape this service speaks.
 *
 * Route handlers throw `HttpError`; the centralized handler in
 * `middleware/error.ts` turns it into a JSON response. Anything else that
 * escapes a handler is a bug and becomes a 500 with no internal detail leaked.
 */

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    /** Field-level detail, present only on validation failures. */
    details?: { path: string; message: string }[];
  };
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: { path: string; message: string }[] | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: { path: string; message: string }[]): HttpError {
    return new HttpError(400, 'bad_request', message, details);
  }

  static unauthorized(message = 'Authentication required.'): HttpError {
    return new HttpError(401, 'unauthorized', message);
  }

  static forbidden(message = 'You do not have access to this resource.'): HttpError {
    return new HttpError(403, 'forbidden', message);
  }

  static notFound(message = 'Not found.'): HttpError {
    return new HttpError(404, 'not_found', message);
  }

  static tooManyRequests(message: string): HttpError {
    return new HttpError(429, 'too_many_requests', message);
  }
}
