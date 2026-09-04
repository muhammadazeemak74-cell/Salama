/**
 * Bearer JWT authentication.
 *
 * `authenticate` verifies the token and attaches the caller to
 * `req.user`; `requireRole` gates a route on that user's role. Tokens are
 * minted in `routes/auth.ts` after OTP verification.
 */

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { config } from '../config.ts';
import { HttpError } from '../errors.ts';

export const USER_ROLES = ['buyer', 'seller', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** What every authenticated handler can rely on. */
export interface AuthenticatedUser {
  id: string;
  phone_number: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `authenticate`; absent on public routes. */
      user?: AuthenticatedUser;
    }
  }
}

interface AuthTokenClaims {
  sub: string;
  phone_number: string;
  role: UserRole;
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

/** Mint a token for a user who has just proved they hold the phone number. */
export function signAuthToken(user: AuthenticatedUser): string {
  return jwt.sign(
    { phone_number: user.phone_number, role: user.role },
    config.jwt.secret,
    {
      subject: user.id,
      issuer: config.jwt.issuer,
      expiresIn: config.jwt.expiresInSeconds,
    },
  );
}

function bearerToken(req: Request): string | undefined {
  const header = req.get('authorization');
  if (!header) return undefined;

  const [scheme, ...rest] = header.split(' ');
  // Case-insensitive: RFC 7235 says the scheme is not case sensitive, and
  // mobile HTTP clients are inconsistent about it.
  if (scheme?.toLowerCase() !== 'bearer') return undefined;

  const token = rest.join(' ').trim();
  return token === '' ? undefined : token;
}

function verify(token: string): AuthenticatedUser {
  let claims: string | jwt.JwtPayload;
  try {
    claims = jwt.verify(token, config.jwt.secret, { issuer: config.jwt.issuer });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw HttpError.unauthorized('Session expired. Please sign in again.');
    }
    throw HttpError.unauthorized('Invalid authentication token.');
  }

  if (typeof claims === 'string') {
    throw HttpError.unauthorized('Invalid authentication token.');
  }

  const { sub, phone_number: phoneNumber, role } = claims as Partial<AuthTokenClaims>;
  if (typeof sub !== 'string' || typeof phoneNumber !== 'string' || !isUserRole(role)) {
    throw HttpError.unauthorized('Invalid authentication token.');
  }

  return { id: sub, phone_number: phoneNumber, role };
}

/** Require a valid Bearer token. Rejects with 401 otherwise. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = bearerToken(req);
  if (!token) {
    next(HttpError.unauthorized('Missing Bearer token.'));
    return;
  }

  try {
    req.user = verify(token);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Attach the caller when a token is present, but let anonymous requests
 * through. For endpoints that show more to a signed-in user.
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = bearerToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    req.user = verify(token);
    next();
  } catch (error) {
    next(error);
  }
}

/** Gate a route on the caller's role. Mount after `authenticate`. */
export function requireRole(...roles: readonly UserRole[]) {
  return function roleGuard(req: Request, _res: Response, next: NextFunction): void {
    if (!req.user) {
      next(HttpError.unauthorized());
      return;
    }
    // Admins are deliberately allowed everywhere a role is required.
    if (req.user.role !== 'admin' && !roles.includes(req.user.role)) {
      next(HttpError.forbidden(`This endpoint requires the ${roles.join(' or ')} role.`));
      return;
    }
    next();
  };
}

/** Narrow `req.user` for handlers mounted behind `authenticate`. */
export function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) {
    // Only reachable if a handler is mounted without `authenticate`.
    throw HttpError.unauthorized();
  }
  return req.user;
}
