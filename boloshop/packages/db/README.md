# @boloshop/db

Shared PostgreSQL schema, migrations, and connection helper for every BoloShop
service.

## Layout

```
migrations/001_initial_schema.sql   users, sellers, products, videos, orders, team_purchases
src/index.ts                        connection pool + query/transaction helpers
src/migrate.ts                      forward-only migration runner (CLI)
```

## Configuration

Copy `.env.example` to `.env` for local work. `DATABASE_URL` takes precedence;
otherwise the discrete `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` /
`PGPASSWORD` variables are used. Nothing is read at import time — the pool is
built on first use, so importing this package in a process with no database
never throws.

## Commands

```bash
npm run build          --workspace @boloshop/db   # tsc -> dist/
npm run typecheck      --workspace @boloshop/db
npm run migrate        --workspace @boloshop/db   # apply pending migrations
npm run migrate:status --workspace @boloshop/db   # list applied / pending
```

## Using the pool

```ts
import { queryRows, withTransaction } from '@boloshop/db';

const products = await queryRows<{ id: string; price_pkr: string }>(
  'SELECT id, price_pkr FROM products WHERE category = $1 AND stock_quantity > 0',
  [category],
);

// Anything that must be atomic gets a transaction. Use the passed client for
// every statement inside — the module-level helpers use a different connection.
await withTransaction(async (tx) => {
  await tx.query('UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = $1', [id]);
  await tx.query('INSERT INTO orders (buyer_id, seller_id, total_amount_pkr) VALUES ($1, $2, $3)',
    [buyerId, sellerId, total]);
});
```

`closePool()` on shutdown. It is safe to call twice.

### Money is a string

`NUMERIC` and `BIGINT` columns come back as strings, on purpose: a JS number
cannot represent every PKR value exactly, and this is an app that moves cash.
Do decimal arithmetic with a decimal library — never `parseFloat` a
`price_pkr`, `total_amount_pkr`, or `commission_fee_pkr`.

## Migrations

Forward-only. Each `.sql` file in `migrations/` runs once, in filename order,
inside its own transaction, on a connection holding an advisory lock so two
pods booting together cannot both apply it. Applied files are recorded in
`schema_migrations` with a SHA-256 checksum, so editing a migration that has
already run is rejected rather than silently skipped.

There is no `down`. To change something, add `002_….sql`. To apply a file by
hand: `psql -1 -f migrations/001_initial_schema.sql` — the files open no
transaction of their own.

## Schema notes

- **Ids** are UUIDs (`gen_random_uuid()`), so clients can mint them offline.
- **Commission** is a generated column: `commission_fee_pkr` is always
  `round(total_amount_pkr * 0.01, 2)`, computed by PostgreSQL. No caller can
  write a different value; changing the 1% rate takes a migration.
- **Deletes** cascade for seller-owned content (products, videos) but are
  restricted for anything an order points at, so financial history is never
  orphaned. Deleting a seller's user account fails while they have orders —
  that is deliberate.
- **`bank_details`** is JSONB and sensitive. Encrypt at the application layer
  before writing, and keep it out of response payloads.
- **Phone numbers** are stored E.164 (`+923001234567`) and constrained to it.
  Normalise before insert. `users.phone_number` is uniquely indexed; it is the
  login identity.
- **Enums** (`user_role`, `language_preference`, `order_status`,
  `payment_method`, `team_purchase_status`) grow via
  `ALTER TYPE … ADD VALUE` in a new migration. `payment_method` is `cod` alone
  at launch; Easypaisa and JazzCash join it when payouts land.
