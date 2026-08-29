/**
 * The one error shape this service speaks — same contract as the API gateway,
 * so a client that handles one handles both.
 */

export interface ErrorBody {
  error: {
    code: string;
    message: string;
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

  static forbidden(message: string): HttpError {
    return new HttpError(403, 'forbidden', message);
  }

  static notFound(message = 'Not found.'): HttpError {
    return new HttpError(404, 'not_found', message);
  }

  static payloadTooLarge(message: string): HttpError {
    return new HttpError(413, 'payload_too_large', message);
  }

  /** 402: the seller is out of AI video credits. */
  static paymentRequired(message: string): HttpError {
    return new HttpError(402, 'insufficient_credits', message);
  }

  /** 503: FFmpeg is missing, so no render can be attempted at all. */
  static ffmpegUnavailable(message: string): HttpError {
    return new HttpError(503, 'ffmpeg_unavailable', message);
  }
}
