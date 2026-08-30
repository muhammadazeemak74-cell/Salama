/**
 * Seller AI-video credits.
 *
 * The seller lookup is real — the id is checked against the `sellers` table
 * through @boloshop/db, so a render cannot be booked against a store that does
 * not exist. The BALANCE is mocked: there is no credits column in the schema
 * yet, so balances live in memory and start at MOCK_VIDEO_CREDITS_PER_SELLER.
 *
 * Replacing the mock means one migration and this one file:
 *
 *   CREATE TABLE seller_video_credits (
 *     seller_id  UUID PRIMARY KEY REFERENCES sellers (id) ON DELETE CASCADE,
 *     balance    INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
 *     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *
 * and then `deduct` becomes a single guarded UPDATE inside a transaction:
 * `UPDATE … SET balance = balance - $2 WHERE seller_id = $1 AND balance >= $2`,
 * whose row count tells you whether the seller could afford it. Until then
 * this is per-process and forgets everything on restart.
 */

import { queryOne } from '@boloshop/db';

import { config } from '../config.ts';

const balances = new Map<string, number>();

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

export function getBalance(sellerId: string): number {
  return balances.get(sellerId) ?? config.credits.mockPerSeller;
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
export function deduct(sellerId: string, cost = config.credits.costPerRender): number {
  const balance = getBalance(sellerId);
  if (balance < cost) throw new InsufficientCreditsError(balance, cost);

  const remaining = balance - cost;
  balances.set(sellerId, remaining);
  return remaining;
}

/** Return credits after a failed render. The seller should not pay for a crash. */
export function refund(sellerId: string, cost = config.credits.costPerRender): number {
  const restored = getBalance(sellerId) + cost;
  balances.set(sellerId, restored);
  return restored;
}

/** Test hook. */
export function resetCredits(): void {
  balances.clear();
}
