/**
 * Stub for @boloshop/db.
 *
 * The credit tests are about balance arithmetic, not SQL, so the seller lookup
 * is a function the test controls. Only the surface media-service actually
 * uses is stubbed; anything else it starts importing will fail loudly here,
 * which is the point.
 */

type QueryRow = Record<string, unknown>;

/** Set by a test to decide what the next seller lookup returns. */
export const dbStub = {
  queryOne: jest.fn<Promise<QueryRow | undefined>, [string, unknown[]?]>(),
  reset(): void {
    dbStub.queryOne.mockReset();
    dbStub.queryOne.mockResolvedValue(undefined);
  },
};

export const queryOne = (sql: string, params?: unknown[]) =>
  dbStub.queryOne(sql, params);

export const ping = jest.fn<Promise<boolean>, []>().mockResolvedValue(true);
export const closePool = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
