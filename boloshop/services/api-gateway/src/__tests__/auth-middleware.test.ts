import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { config } from '../config.ts';
import { HttpError } from '../errors.ts';
import {
  authenticate,
  optionalAuthenticate,
  requireRole,
  requireUser,
  signAuthToken,
  type AuthenticatedUser,
} from '../middleware/auth.ts';

const buyer: AuthenticatedUser = {
  id: '22222222-2222-2222-2222-222222222222',
  phone_number: '+923339876543',
  role: 'buyer',
};

const seller: AuthenticatedUser = {
  id: '11111111-1111-1111-1111-111111111111',
  phone_number: '+923004440000',
  role: 'seller',
};

/** A Request stub carrying just the headers the middleware reads. */
function requestWith(authorization?: string): Request {
  return {
    get(name: string) {
      return name.toLowerCase() === 'authorization' ? authorization : undefined;
    },
  } as unknown as Request;
}

const noopResponse = {} as Response;

/** Runs a middleware and reports what it passed to next(). */
function run(
  middleware: (req: Request, res: Response, next: NextFunction) => void,
  req: Request,
): { error?: unknown; called: boolean } {
  let error: unknown;
  let called = false;

  middleware(req, noopResponse, ((passed?: unknown) => {
    called = true;
    error = passed;
  }) as NextFunction);

  return { error, called };
}

describe('signAuthToken', () => {
  it('mints a token carrying the id, phone and role', () => {
    const decoded = jwt.verify(signAuthToken(seller), config.jwt.secret) as
      jwt.JwtPayload;

    expect(decoded.sub).toBe(seller.id);
    expect(decoded.phone_number).toBe(seller.phone_number);
    expect(decoded.role).toBe('seller');
    expect(decoded.iss).toBe(config.jwt.issuer);
  });

  it('expires the token at the configured lifetime', () => {
    const decoded = jwt.verify(signAuthToken(buyer), config.jwt.secret) as
      jwt.JwtPayload;

    expect(decoded.exp! - decoded.iat!).toBe(config.jwt.expiresInSeconds);
  });
});

describe('authenticate', () => {
  it('attaches the caller for a valid token', () => {
    const req = requestWith(`Bearer ${signAuthToken(seller)}`);
    const { error } = run(authenticate, req);

    expect(error).toBeUndefined();
    expect(req.user).toEqual(seller);
  });

  it('accepts a lowercase scheme', () => {
    // RFC 7235 says the scheme is case-insensitive, and mobile HTTP clients
    // are inconsistent about it.
    const req = requestWith(`bearer ${signAuthToken(buyer)}`);

    expect(run(authenticate, req).error).toBeUndefined();
    expect(req.user).toEqual(buyer);
  });

  const badHeaders: Array<[string | undefined, string]> = [
    [undefined, 'no header'],
    ['', 'an empty header'],
    ['Bearer', 'a scheme with no token'],
    ['Bearer    ', 'a scheme with only whitespace'],
    ['Basic abc123', 'the wrong scheme'],
    ['abc123', 'a bare token with no scheme'],
  ];

  it.each(badHeaders)('rejects %s (%s) with 401', (header) => {
    const { error } = run(authenticate, requestWith(header));

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(401);
  });

  it('rejects a token signed with a different secret', () => {
    const forged = jwt.sign({ phone_number: seller.phone_number, role: 'admin' },
      'not-the-real-secret',
      { subject: seller.id, issuer: config.jwt.issuer, expiresIn: 3600 },
    );

    const { error } = run(authenticate, requestWith(`Bearer ${forged}`));

    expect((error as HttpError).status).toBe(401);
    expect((error as HttpError).message).toBe('Invalid authentication token.');
  });

  it('rejects a token from a different issuer', () => {
    const foreign = jwt.sign({ phone_number: buyer.phone_number, role: 'buyer' },
      config.jwt.secret,
      { subject: buyer.id, issuer: 'someone-else', expiresIn: 3600 },
    );

    expect((run(authenticate, requestWith(`Bearer ${foreign}`)).error as HttpError)
      .status).toBe(401);
  });

  it('distinguishes an expired session so the app can say "sign in again"', () => {
    const expired = jwt.sign({ phone_number: buyer.phone_number, role: 'buyer' },
      config.jwt.secret,
      { subject: buyer.id, issuer: config.jwt.issuer, expiresIn: -10 },
    );

    const { error } = run(authenticate, requestWith(`Bearer ${expired}`));

    expect((error as HttpError).status).toBe(401);
    expect((error as HttpError).message).toBe(
      'Session expired. Please sign in again.',
    );
  });

  const incompleteClaims: Array<[Record<string, string>, string]> = [
    [{ phone_number: '+923001234567', role: 'buyer' }, 'no subject'],
    [{ sub: 'x', role: 'buyer' }, 'no phone number'],
    [{ sub: 'x', phone_number: '+923001234567' }, 'no role'],
    [{ sub: 'x', phone_number: '+923001234567', role: 'superuser' }, 'an unknown role'],
  ];

  it.each(incompleteClaims)('rejects a well-signed token with %s (%s)', (claims) => {
    // Correctly signed but missing what the app needs — a token from an older
    // version, or one somebody hand-rolled.
    const token = jwt.sign(claims, config.jwt.secret, {
      issuer: config.jwt.issuer,
      expiresIn: 3600,
    });

    expect((run(authenticate, requestWith(`Bearer ${token}`)).error as HttpError)
      .status).toBe(401);
  });
});

describe('optionalAuthenticate', () => {
  it('lets an anonymous request through with no user', () => {
    const req = requestWith(undefined);
    const { error, called } = run(optionalAuthenticate, req);

    expect(called).toBe(true);
    expect(error).toBeUndefined();
    expect(req.user).toBeUndefined();
  });

  it('attaches the caller when a valid token is present', () => {
    const req = requestWith(`Bearer ${signAuthToken(buyer)}`);
    run(optionalAuthenticate, req);

    expect(req.user).toEqual(buyer);
  });

  it('still rejects a token that is present but invalid', () => {
    // Optional means "you may be anonymous", not "send me anything".
    const { error } = run(optionalAuthenticate, requestWith('Bearer garbage'));

    expect((error as HttpError).status).toBe(401);
  });
});

describe('requireRole', () => {
  it('admits the named role', () => {
    const req = requestWith(`Bearer ${signAuthToken(seller)}`);
    run(authenticate, req);

    expect(run(requireRole('seller'), req).error).toBeUndefined();
  });

  it('refuses another role with 403, naming what is needed', () => {
    const req = requestWith(`Bearer ${signAuthToken(buyer)}`);
    run(authenticate, req);

    const { error } = run(requireRole('seller'), req);

    expect((error as HttpError).status).toBe(403);
    expect((error as HttpError).message).toContain('seller');
  });

  it('lets an admin through any role gate', () => {
    const admin: AuthenticatedUser = { ...buyer, role: 'admin' };
    const req = requestWith(`Bearer ${signAuthToken(admin)}`);
    run(authenticate, req);

    expect(run(requireRole('seller'), req).error).toBeUndefined();
  });

  it('accepts any of several roles', () => {
    const req = requestWith(`Bearer ${signAuthToken(buyer)}`);
    run(authenticate, req);

    expect(run(requireRole('buyer', 'seller'), req).error).toBeUndefined();
  });

  it('returns 401, not 403, when it is mounted without authenticate', () => {
    // The distinction matters to the client: 401 means "sign in", 403 means
    // "signed in, but not allowed".
    const { error } = run(requireRole('seller'), requestWith(undefined));

    expect((error as HttpError).status).toBe(401);
  });
});

describe('requireUser', () => {
  it('narrows req.user for a handler behind authenticate', () => {
    const req = requestWith(`Bearer ${signAuthToken(seller)}`);
    run(authenticate, req);

    expect(requireUser(req)).toEqual(seller);
  });

  it('throws 401 when no middleware attached a user', () => {
    expect(() => requireUser(requestWith(undefined))).toThrow(HttpError);
  });
});
