# order-service

The Go microservice that owns orders and logistics: order creation with the 1%
platform commission, COD shipment tracking, and Pinduoduo-style team purchases.
It reads and writes the same PostgreSQL schema as the Node services, defined in
`packages/db`.

## Layout

```
cmd/server/main.go          entrypoint: config, pool, HTTP server, graceful shutdown
internal/config             environment, read once at boot
internal/httpx              shared JSON error shape, decoder, handler adapter
internal/validate           E.164, UUID and PKR-amount checks; PKR formatting
internal/orders             order lifecycle, shipment state machine, WhatsApp link
internal/teambuy            24-hour group buys and the discount application
internal/health             GET /health
```

## Running

```bash
cp .env.example .env    # then export DATABASE_URL, or set it inline
make run                # go run ./cmd/server
make check              # gofmt + vet + build + test — run this before pushing
```

`make help` lists every target. The schema must be migrated first:
`npm run migrate --workspace @boloshop/db` from `boloshop/`.

The service pings PostgreSQL before binding the port, so a pod with a bad
`DATABASE_URL` fails at boot rather than serving errors, and drains in-flight
requests on SIGTERM before closing the pool.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/orders` | create an order, get the WhatsApp confirmation link |
| GET | `/api/v1/orders/{id}` | order plus current shipment status |
| POST | `/api/v1/orders/{id}/tracking` | advance the shipment state |
| POST | `/api/v1/team-buy/create` | open a 24-hour team purchase |
| POST | `/api/v1/team-buy/join` | join one, applying the discount |
| GET | `/health` | 200 when the database answers, 503 when it does not |

Errors use the same envelope as the Node services, so the Flutter client has
one error branch for the whole backend:

```json
{ "error": { "code": "invalid_status_transition", "message": "...", "details": [] } }
```

Routing is stdlib `net/http`: method-and-wildcard `ServeMux` patterns have been
built in since Go 1.22, so this service carries no router dependency. `pgx/v5`
is the only direct requirement.

## How the money works

**The 1% commission is not computed here.** `orders.commission_fee_pkr` is a
generated column — `round(total_amount_pkr * 0.01, 2)`, computed by Postgres —
so the insert deliberately does not pass it, and `POST /api/v1/orders` rejects a
body that tries to. The rate cannot drift because some caller disagreed with it,
and it recomputes itself when a team-buy discount changes the total.

**PKR amounts are strings from end to end.** They are `NUMERIC(12,2)` in the
database, cast to `text` in every query, and never decoded into a `float64`.
Where arithmetic is unavoidable — the "you saved" figure — it happens in integer
paisa. The discount itself is applied by Postgres on `NUMERIC`.

## The shipment state machine

```
pending ──▶ shipped ──▶ delivered
                    └─▶ rto_returned
```

`delivered` and `rto_returned` are terminal, so a courier webhook replaying an
old event cannot walk an order backwards. Moving to `shipped` requires a
`courier_tracking_id`: handing a parcel over without recording its consignment
number means nobody can find it again. The read and write share one transaction
with `SELECT ... FOR UPDATE`, so two webhooks arriving together cannot both
decide they may ship the same order.

## Team purchases

A buyer opens a team purchase on their own pending order, shares the link, and
whoever joins within the window unlocks a discount of 20–30% (default 25) for
both. Joining applies the discount to the order total, which makes the
commission recompute itself.

Two things are worth knowing:

- **Expiry is derived, not stored.** `team_purchases` has no expiry column, so
  the window is `created_at` plus `TEAM_BUY_WINDOW_HOURS`, measured against the
  database's clock rather than any single pod's. A join after the window returns
  410 and records `status = 'expired'` so the next reader does not have to
  derive it again. Adding a real column later would not change this API.
- **Joining is serialised.** The team purchase and the order are both locked
  `FOR UPDATE` for the whole join, so five friends tapping one link at the same
  instant produce exactly one winner and one application of the discount — not
  five. This is covered by the concurrency behaviour the transaction gives us,
  not by an application-level check that could race.

## Verification

`make check` runs gofmt, `go vet`, `go build ./...` and `go test ./...`. The
unit tests cover the pure logic: the state machine, E.164 and amount
validation, PKR formatting, WhatsApp link construction and escaping, the
discount band, exact paisa arithmetic, and the expiry window. Everything that
needs a database is exercised against a real PostgreSQL instance rather than a
mock.
