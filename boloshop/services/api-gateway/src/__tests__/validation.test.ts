import { HttpError } from '../errors.ts';
import {
  paginationSchema,
  parseOrThrow,
  phoneNumberSchema,
  pkrAmountSchema,
} from '../validation.ts';

describe('phoneNumberSchema', () => {
  it.each([
    '+923001234567',
    '+923339876543',
    '+12025550143',
    '+441234567',
  ])('accepts %s', (phone) => {
    expect(phoneNumberSchema.parse(phone)).toBe(phone);
  });

  it('trims surrounding whitespace before validating', () => {
    expect(phoneNumberSchema.parse('  +923001234567  ')).toBe('+923001234567');
  });

  it.each([
    ['', 'empty'],
    ['03001234567', 'local Pakistani format with no country code'],
    ['923001234567', 'no leading plus'],
    ['+0923001234567', 'leading zero after the plus'],
    ['+92 300 1234567', 'spaces'],
    ['+92-300-1234567', 'separators'],
    ['+123456', 'too short'],
    ['+9230012345678901234', 'too long'],
    ['+92300123456a', 'a non-digit'],
  ])('rejects %s (%s)', (phone) => {
    expect(phoneNumberSchema.safeParse(phone).success).toBe(false);
  });

  it('explains the format it wants', () => {
    const result = phoneNumberSchema.safeParse('03001234567');

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toContain('E.164');
    expect(result.error.issues[0]?.message).toContain('+923001234567');
  });
});

describe('pkrAmountSchema', () => {
  it.each(['0', '4499', '4499.5', '4499.50', '1234567890.99'])(
    'accepts %s',
    (amount) => {
      expect(pkrAmountSchema.parse(amount)).toBe(amount);
    },
  );

  it('accepts a JSON number and hands back a string', () => {
    // Money stays a string end to end; a client sending 3500 must not turn
    // into a float somewhere downstream.
    expect(pkrAmountSchema.parse(3500)).toBe('3500');
    expect(typeof pkrAmountSchema.parse(4499.5)).toBe('string');
  });

  it.each([
    ['-1', 'negative'],
    ['4499.999', 'three decimal places — NUMERIC(12,2) cannot hold it'],
    ['4,499', 'thousands separator'],
    ['1e5', 'exponent notation'],
    ['abc', 'not a number'],
    ['', 'empty'],
    ['12345678901', 'more digits than NUMERIC(12,2) allows'],
  ])('rejects %s (%s)', (amount) => {
    expect(pkrAmountSchema.safeParse(amount).success).toBe(false);
  });
});

describe('paginationSchema', () => {
  it('defaults to a page a mobile client can actually load', () => {
    expect(paginationSchema.parse({})).toEqual({ limit: 20, offset: 0 });
  });

  it('coerces the strings that arrive on a query string', () => {
    expect(paginationSchema.parse({ limit: '5', offset: '10' })).toEqual({
      limit: 5,
      offset: 10,
    });
  });

  it('caps the page size', () => {
    // The cap is deliberate: this feed is served over mobile data.
    expect(paginationSchema.safeParse({ limit: 50 }).success).toBe(true);
    expect(paginationSchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(paginationSchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it('rejects a negative offset and a fractional limit', () => {
    expect(paginationSchema.safeParse({ offset: -1 }).success).toBe(false);
    expect(paginationSchema.safeParse({ limit: 2.5 }).success).toBe(false);
  });
});

describe('parseOrThrow', () => {
  it('returns the parsed value on success', () => {
    expect(parseOrThrow(phoneNumberSchema, '+923001234567')).toBe(
      '+923001234567',
    );
  });

  it('throws a 400 HttpError carrying every field that failed', () => {
    const schema = paginationSchema.extend({ phone: phoneNumberSchema });

    let thrown: unknown;
    try {
      parseOrThrow(schema, { limit: 999, phone: 'nope' });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpError);
    const httpError = thrown as HttpError;
    expect(httpError.status).toBe(400);
    expect(httpError.code).toBe('bad_request');

    const paths = httpError.details?.map((detail) => detail.path).sort();
    expect(paths).toEqual(['limit', 'phone']);
  });

  it('labels a root-level failure rather than emitting an empty path', () => {
    let thrown: unknown;
    try {
      parseOrThrow(phoneNumberSchema, 12345);
    } catch (error) {
      thrown = error;
    }

    const httpError = thrown as HttpError;
    expect(httpError.details?.[0]?.path).toBe('(root)');
  });
});
