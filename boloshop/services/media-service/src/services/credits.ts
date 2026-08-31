/**
 * Seller AI-video credits, in Redis.
 *
 * The balance lives in Redis rather than in a process's memory because a
 * render can be booked by any pod: a seller with one credit left must not be
 * able to start two renders by hitting two pods at once.
 *
 * The seller lookup is still Postgres — `sellers` is relational data — and is
 * unchanged. What moved is the counter.
 *
 * NOTE ON DURABILITY. Redis is the system of record for this balance, so it
 * needs persistence turned on (AOF, or RDB at a cadence you can afford to lose
 * renders across). It is still not a ledger: there is no history of who spent
 * what. Deducting against a `seller_video_credits` table in the same
 * transaction as the render booking is the eventual home for this; Redis makes
 * it correct across pods, not auditable.
 */

import { getRedis, queryOne } from '@boloshop/db';

import { config } from '../config.ts';

/** One key per seller. */
const KEY_PREFIX = 'seller:credits:';

function keyFor(sellerId: string): string {
  return `${KEY_PREFIX}${sellerId}`;
}

export interface SellerCredits {
  sellerId: string;
  storeName: string;
  balance: number;
}

/** Look the seller up for real. Returns undefined when there is no such store. */
export async function findSeller(
  sellerId: string,
): Promise<{ id: string; store_name: string } | undefined> {
  return queryOne<{ id: string; store_name: string }>(
    'SELECT id, store_name FROM sellers WHERE id = $1',
    [sellerId],
  );
}

/**
 * Seed a seller's balance on first sight, then read it.
 *
 * SET NX is the seeding step: the first pod to ask creates the key, and every
 * later one leaves it alone. Doing this as GET-then-SET in Node would let two
 * pods both seed and one silently overwrite a balance the other had already
 * spent from.
 */
const READ_SCRIPT = `
redis.call('SET', KEYS[1], ARGV[1], 'NX')
return redis.call('GET', KEYS[1])
`;

/**
 * Spend `cost` credits, or refuse.
 *
 * The check and the DECRBY are one script so they cannot interleave: without
 * that, two concurrent renders both read "1 credit left", both decide they can
 * afford it, and the balance ends at -1 with two renders running.
 *
 * Returns [1, remaining] on success, [0, balance] when there are not enough.
 */
const DEDUCT_SCRIPT = `
redis.call('SET', KEYS[1], ARGV[2], 'NX')

local balance = tonumber(redis.call('GET', KEYS[1]))
local cost = tonumber(ARGV[1])

if balance == nil then
  balance = 0
end

if balance < cost then
  return {0, balance}
end

local remaining = redis.call('DECRBY', KEYS[1], cost)
return {1, remaining}
`;

async function runScript(
  script: string,
  key: string,
  args: (string | number)[],
): Promise<unknown> {
  return getRedis().eval(script, 1, key, ...args);
}

/** The seller's current balance, seeding the starting allowance if unset. */
export async function getBalance(sellerId: string): Promise<number> {
  const raw = await runScript(READ_SCRIPT, keyFor(sellerId), [
    config.credits.startingBalance,
  ]);
  return Number.parseInt(String(raw), 10);
}

export class InsufficientCreditsError extends Error {
  readonly balance: number;
  readonly required: number;

  constructor(balance: number, required: number) {
    super(
      `This store has ${balance} AI video credit(s) left and needs ${required}. ` +
        'Top up to render another promo.',
    );
    this.name = 'InsufficientCreditsError';
    this.balance = balance;
    this.required = required;
  }
}

/**
 * Take `cost` credits from the seller, or throw. Returns the new balance.
 *
 * Deduct before rendering, not after: a render costs real CPU, so the credit
 * has to be spent up front. `refund` puts it back if the render fails.
 */
export async function deduct(
  sellerId: string,
  cost = config.credits.costPerRender,
): Promise<number> {
  const reply = (await runScript(DEDUCT_SCRIPT, keyFor(sellerId), [
    cost,
    config.credits.startingBalance,
  ])) as [number, number];

  const [ok, balance] = reply;
  if (ok !== 1) throw new InsufficientCreditsError(Number(balance), cost);

  return Number(balance);
}

/**
 * Return credits after a failed render. The seller should not pay for a crash.
 *
 * INCRBY is atomic on its own, so this needs no script.
 */
export async function refund(
  sellerId: string,
  cost = config.credits.costPerRender,
): Promise<number> {
  return getRedis().incrby(keyFor(sellerId), cost);
}

/**
 * Set a seller's balance outright — for a top-up, or to reset one in a test.
 */
export async function setBalance(sellerId: string, balance: number): Promise<void> {
  await getRedis().set(keyFor(sellerId), String(balance));
}

/**
 * Drop every stored balance, so the next read reseeds the allowance.
 *
 * Scans its own namespace rather than flushing the database: OTP challenges
 * live in the same Redis.
 */
export async function resetCredits(): Promise<void> {
  const redis = getRedis();
  const keyPrefix = process.env.REDIS_KEY_PREFIX ?? '';
  const pattern = `${keyPrefix}${KEY_PREFIX}*`;

  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 500);
    cursor = next;
    if (keys.length > 0) {
      // SCAN returns fully-qualified names; ioredis re-applies keyPrefix to the
      // keys of commands it sends, so it comes back off before the delete.
      const unprefixed = keys.map((key) =>
        keyPrefix && key.startsWith(keyPrefix) ? key.slice(keyPrefix.length) : key,
      );
      await redis.pipeline(unprefixed.map((key) => ['unlink', key])).exec();
    }
  } while (cursor !== '0');
}
