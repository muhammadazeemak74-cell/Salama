import { closeRedis, getRedis } from '@boloshop/db';

import { config } from '../config.ts';
import {
  InsufficientCreditsError,
  deduct,
  findSeller,
  getBalance,
  refund,
  resetCredits,
  setBalance,
} from '../services/credits.ts';
import { dbStub } from './mocks/boloshop-db.ts';

const SELLER = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTHER_SELLER = 'aaaaaaaa-0000-0000-0000-000000000002';

/**
 * These run against a real Redis (database 15, see setup-env.ts).
 *
 * The check-and-decrement is a Lua script running inside Redis; that is what
 * makes it safe across pods, and it is not something a fake client can stand in
 * for.
 */
beforeAll(async () => {
  try {
    await getRedis().ping();
  } catch (error) {
    throw new Error(
      'These tests need Redis on ' +
        `${process.env.REDIS_URL}. Start one with: redis-server --port 6379\n` +
        `Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
});

beforeEach(async () => {
  await resetCredits();
  dbStub.reset();
});

afterAll(async () => {
  await resetCredits();
  await closeRedis();
});

describe('credit balances', () => {
  it('seeds a seller at the configured allowance on first sight', async () => {
    await expect(getBalance(SELLER)).resolves.toBe(config.credits.startingBalance);
  });

  it('seeds once — reading again does not reset a spent balance', async () => {
    await deduct(SELLER);
    const afterSpend = await getBalance(SELLER);

    await expect(getBalance(SELLER)).resolves.toBe(afterSpend);
    expect(afterSpend).toBe(config.credits.startingBalance - 1);
  });

  it('deducts the render cost and reports what is left', async () => {
    const remaining = await deduct(SELLER);

    expect(remaining).toBe(
      config.credits.startingBalance - config.credits.costPerRender,
    );
    await expect(getBalance(SELLER)).resolves.toBe(remaining);
  });

  it('keeps balances separate per seller', async () => {
    await deduct(SELLER);

    await expect(getBalance(OTHER_SELLER)).resolves.toBe(
      config.credits.startingBalance,
    );
  });

  it('runs the balance down to zero and then refuses', async () => {
    for (let i = 0; i < config.credits.startingBalance; i += 1) {
      await deduct(SELLER);
    }

    await expect(getBalance(SELLER)).resolves.toBe(0);
    await expect(deduct(SELLER)).rejects.toThrow(InsufficientCreditsError);
  });

  it('reports the balance and the requirement on refusal', async () => {
    await setBalance(SELLER, 0);

    const error = await deduct(SELLER).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InsufficientCreditsError);
    const insufficient = error as InsufficientCreditsError;
    expect(insufficient.balance).toBe(0);
    expect(insufficient.required).toBe(config.credits.costPerRender);
    expect(insufficient.message).toContain('Top up');
  });

  it('does not move the balance when it refuses', async () => {
    await setBalance(SELLER, 0);

    await expect(deduct(SELLER)).rejects.toThrow();
    await expect(getBalance(SELLER)).resolves.toBe(0);
  });

  it('refuses a deduction larger than the balance, leaving it untouched', async () => {
    await expect(
      deduct(SELLER, config.credits.startingBalance + 1),
    ).rejects.toThrow(InsufficientCreditsError);

    await expect(getBalance(SELLER)).resolves.toBe(config.credits.startingBalance);
  });

  it('never lets the balance go negative under concurrency', async () => {
    // The reason this moved out of process memory. One credit, five pods
    // booking a render at the same instant: exactly one may win, and the
    // balance must land on 0 rather than -4.
    await setBalance(SELLER, 1);

    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () =>
        deduct(SELLER).then(
          () => 'granted' as const,
          () => 'refused' as const,
        ),
      ),
    );

    expect(outcomes.filter((o) => o === 'granted')).toHaveLength(1);
    expect(outcomes.filter((o) => o === 'refused')).toHaveLength(4);
    await expect(getBalance(SELLER)).resolves.toBe(0);
  });

  it('grants exactly as many concurrent renders as there are credits', async () => {
    await setBalance(SELLER, 3);

    const outcomes = await Promise.all(
      Array.from({ length: 10 }, () =>
        deduct(SELLER).then(
          () => 'granted' as const,
          () => 'refused' as const,
        ),
      ),
    );

    expect(outcomes.filter((o) => o === 'granted')).toHaveLength(3);
    await expect(getBalance(SELLER)).resolves.toBe(0);
  });
});

describe('refund on a failed render', () => {
  it('puts the credit back, leaving the seller where they started', async () => {
    // The credit is spent before FFmpeg runs, because a render costs real CPU.
    // If the render then fails, the seller must not pay for our crash.
    const before = await getBalance(SELLER);

    await deduct(SELLER);
    await expect(getBalance(SELLER)).resolves.toBe(before - 1);

    await refund(SELLER);
    await expect(getBalance(SELLER)).resolves.toBe(before);
  });

  it('restores the ability to render after a failure', async () => {
    await setBalance(SELLER, 1);
    await deduct(SELLER);
    await expect(deduct(SELLER)).rejects.toThrow();

    await refund(SELLER);
    await expect(deduct(SELLER)).resolves.toBe(0);
  });

  it('balances out over a run of failures', async () => {
    const before = await getBalance(SELLER);

    for (let i = 0; i < 3; i += 1) {
      await deduct(SELLER);
      await refund(SELLER);
    }

    await expect(getBalance(SELLER)).resolves.toBe(before);
  });

  it('refunds the same amount that was deducted', async () => {
    const before = await getBalance(SELLER);
    await deduct(SELLER, 3);
    await refund(SELLER, 3);

    await expect(getBalance(SELLER)).resolves.toBe(before);
  });

  it('is exact when refunds and deductions interleave across pods', async () => {
    await setBalance(SELLER, 10);

    await Promise.all([
      ...Array.from({ length: 6 }, () => deduct(SELLER)),
      ...Array.from({ length: 4 }, () => refund(SELLER)),
    ]);

    // 10 - 6 + 4. INCRBY and the deduct script are both atomic, so the
    // interleaving cannot lose an update.
    await expect(getBalance(SELLER)).resolves.toBe(8);
  });
});

describe('findSeller', () => {
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
