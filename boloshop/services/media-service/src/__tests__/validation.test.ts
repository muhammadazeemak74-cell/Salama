import { HttpError } from '../errors.ts';
import { parseOrThrow, pkrAmountSchema } from '../validation.ts';

describe('pkrAmountSchema', () => {
  it.each(['0', '4499', '4499.5', '4499.50', '1234567890.99'])(
    'accepts %s',
    (amount) => {
      expect(pkrAmountSchema.parse(amount)).toBe(amount);
    },
  );

  it('accepts a multipart field value, which always arrives as a string', () => {
    // render-promo is multipart/form-data, so price_pkr is never a JSON number
    // on the wire — but the schema takes both so a JSON caller works too.
    expect(pkrAmountSchema.parse('3500.00')).toBe('3500.00');
    expect(pkrAmountSchema.parse(3500)).toBe('3500');
  });

  it('trims surrounding whitespace', () => {
    expect(pkrAmountSchema.parse('  4499.50  ')).toBe('4499.50');
  });

  it.each([
    ['-1', 'negative'],
    ['4499.999', 'three decimal places — NUMERIC(12,2) cannot hold it'],
    ['4,499', 'thousands separator'],
    ['1e5', 'exponent notation'],
    ['abc', 'not a number'],
    ['', 'empty'],
  ])('rejects %s (%s)', (amount) => {
    expect(pkrAmountSchema.safeParse(amount).success).toBe(false);
  });
});

describe('parseOrThrow', () => {
  it('returns the parsed value on success', () => {
    expect(parseOrThrow(pkrAmountSchema, '3500.00')).toBe('3500.00');
  });

  it('throws a 400 HttpError naming the field that failed', () => {
    let thrown: unknown;
    try {
      parseOrThrow(pkrAmountSchema, '4499.999');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpError);
    const httpError = thrown as HttpError;
    expect(httpError.status).toBe(400);
    expect(httpError.code).toBe('bad_request');
    expect(httpError.details?.[0]?.message).toContain('two decimal places');
  });

  it('uses the same error envelope as the gateway', () => {
    // One error shape across both services is the whole point: the Flutter
    // client has a single branch for it.
    let thrown: unknown;
    try {
      parseOrThrow(pkrAmountSchema, 'abc');
    } catch (error) {
      thrown = error;
    }

    const httpError = thrown as HttpError;
    expect(httpError.details?.[0]).toEqual({
      path: '(root)',
      message: expect.stringContaining('two decimal places'),
    });
  });
});
