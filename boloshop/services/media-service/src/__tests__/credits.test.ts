import { config } from '../config.ts';
import {
  InsufficientCreditsError,
  deduct,
  findSeller,
  getBalance,
  refund,
  resetCredits,
} from '../services/credits.ts';
import { dbStub } from './mocks/boloshop-db.ts';

const SELLER = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTHER_SELLER = 'aaaaaaaa-0000-0000-0000-000000000002';

describe('credit balances', () => {
  beforeEach(() => {
    resetCredits();
    dbStub.reset();
  });

  it('starts every seller at the configured allowance', () => {
    expect(getBalance(SELLER)).toBe(config.credits.mockPerSeller);
  });

  it('deducts the render cost and reports what is left', () => {
    const remaining = deduct(SELLER);

    expect(remaining).toBe(config.credits.mockPerSeller - config.credits.costPerRender);
    expect(getBalance(SELLER)).toBe(remaining);
  });

  it('keeps balances separate per seller', () => {
    deduct(SELLER);

    expect(getBalance(OTHER_SELLER)).toBe(config.credits.mockPerSeller);
  });

  it('runs the balance down to zero and then refuses', () => {
    for (let i = 0; i < config.credits.mockPerSeller; i += 1) {
      deduct(SELLER);
    }

    expect(getBalance(SELLER)).toBe(0);
    expect(() => deduct(SELLER)).toThrow(InsufficientCreditsError);
  });

  it('reports the balance and the requirement on refusal', () => {
    for (let i = 0; i < config.credits.mockPerSeller; i += 1) {
      deduct(SELLER);
    }

    try {
      deduct(SELLER);
      throw new Error('expected an InsufficientCreditsError');
    } catch (error) {
      expect(error).toBeInstanceOf(InsufficientCreditsError);
      const insufficient = error as InsufficientCreditsError;
      expect(insufficient.balance).toBe(0);
      expect(insufficient.required).toBe(config.credits.costPerRender);
      expect(insufficient.message).toContain('Top up');
    }
  });

  it('does not move the balance when it refuses', () => {
    for (let i = 0; i < config.credits.mockPerSeller; i += 1) {
      deduct(SELLER);
    }

    expect(() => deduct(SELLER)).toThrow();
    expect(getBalance(SELLER)).toBe(0);
  });

  it('refuses a deduction larger than the balance', () => {
    expect(() => deduct(SELLER, config.credits.mockPerSeller + 1)).toThrow(
      InsufficientCreditsError,
    );
    expect(getBalance(SELLER)).toBe(config.credits.mockPerSeller);
  });
});

describe('refund on a failed render', () => {
  beforeEach(() => {
    resetCredits();
    dbStub.reset();
  });

  it('puts the credit back, leaving the seller where they started', () => {
    // The credit is spent before FFmpeg runs, because a render costs real CPU.
    // If the render then fails, the seller must not pay for our crash.
    const before = getBalance(SELLER);

    deduct(SELLER);
    expect(getBalance(SELLER)).toBe(before - 1);

    refund(SELLER);
    expect(getBalance(SELLER)).toBe(before);
  });

  it('restores the ability to render after a failure', () => {
    for (let i = 0; i < config.credits.mockPerSeller; i += 1) {
      deduct(SELLER);
    }
    expect(() => deduct(SELLER)).toThrow();

    // The last render failed, so its credit comes back and the next attempt
    // is allowed.
    refund(SELLER);
    expect(() => deduct(SELLER)).not.toThrow();
  });

  it('balances out over a run of failures', () => {
    const before = getBalance(SELLER);

    for (let i = 0; i < 3; i += 1) {
      deduct(SELLER);
      refund(SELLER);
    }

    expect(getBalance(SELLER)).toBe(before);
  });

  it('refunds the same amount that was deducted', () => {
    const before = getBalance(SELLER);
    deduct(SELLER, 3);
    refund(SELLER, 3);

    expect(getBalance(SELLER)).toBe(before);
  });

  it('refunding a seller who never rendered credits them above the default', () => {
    // Documenting the mock's behaviour rather than asserting it is correct:
    // a real ledger would reject a refund with no matching deduction, and this
    // is one of the things the Postgres-backed version has to fix.
    refund(SELLER);

    expect(getBalance(SELLER)).toBe(config.credits.mockPerSeller + 1);
  });
});

describe('findSeller', () => {
  beforeEach(() => {
    resetCredits();
    dbStub.reset();
  });

  it('returns the store when the seller exists', async () => {
    dbStub.queryOne.mockResolvedValue({ id: SELLER, store_name: 'Lahore Lawn House' });

    await expect(findSeller(SELLER)).resolves.toEqual({
      id: SELLER,
      store_name: 'Lahore Lawn House',
    });
  });

  it('queries the sellers table by id', async () => {
    dbStub.queryOne.mockResolvedValue(undefined);
    await findSeller(SELLER);

    const [sql, params] = dbStub.queryOne.mock.calls[0]!;
    expect(sql).toContain('FROM sellers');
    expect(params).toEqual([SELLER]);
  });

  it('returns undefined for a store that does not exist', async () => {
    dbStub.queryOne.mockResolvedValue(undefined);

    await expect(findSeller('00000000-0000-0000-0000-000000000000')).resolves
      .toBeUndefined();
  });
});
