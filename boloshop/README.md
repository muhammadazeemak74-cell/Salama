# BoloShop

Live-commerce for Pakistan: sellers stream product videos, buyers watch a
vertical feed and buy alone or with a friend for a group discount. Cash on
delivery, 1% platform commission.

See `CLAUDE.md` for the architecture and the constraints behind it.

## Layout

| Path | What it is |
| --- | --- |
| `apps/mobile` | Flutter app (iOS / Android) — the video feed and checkout |
| `services/api-gateway` | Express + TypeScript — auth, catalog, media |
| `services/media-service` | Node + FFmpeg — renders 15s vertical promo videos |
| `services/order-service` | Go — orders, COD tracking, team purchases |
| `packages/db` | PostgreSQL schema, migrations, shared pool helper |

The three services share one Postgres schema, defined once in `packages/db`.

## Getting started

```bash
make install                       # npm + go mod + flutter pub get
export DATABASE_URL=postgres://boloshop:boloshop@localhost:5432/boloshop
export JWT_SECRET=$(openssl rand -base64 48)
make db-migrate                    # apply the schema
make dev                           # all three services, Ctrl-C stops them all
```

`make` on its own lists every target. `make health` curls all three services,
and `make stop` frees the ports if `make dev` is running in another terminal.

| Target | Does |
| --- | --- |
| `make build` | Compiles TypeScript, Go, and analyzes the Flutter app |
| `make test` | Runs every test suite |
| `make db-migrate` | Applies pending Postgres migrations |
| `make dev` | Gateway :4000, media :4001, order :4002 |
| `make stop` | Free those ports when `dev` was started elsewhere |
| `make check` | typecheck + lint + test — what CI should run |

Per-language variants (`build-go`, `test-mobile`, `dev-gateway`, …) let you work
on one part without installing the other toolchains. Every target that needs a
tool or an environment variable says so by name when it is missing.

Override a toolchain path if it is not on `PATH`:

```bash
make build FLUTTER=/opt/flutter/bin/flutter
```

## Requirements

Node 20+, Go 1.24+, PostgreSQL 14+, and — for the app — the Flutter SDK.
`media-service` additionally needs the `ffmpeg` binary on the host; without it
the service still starts and reports the gap on `/health`, and render requests
return a 503 that names what is missing.

## Testing

`make test` runs all four suites: Jest for the two TypeScript services, `go
test` for the order service, and `flutter test` for the app.

| Suite | Covers |
| --- | --- |
| `api-gateway` (Jest) | OTP issue/verify/expiry/lockout, Zod schemas, JWT middleware and role gates |
| `media-service` (Jest) | Zod schemas, credit deduction and refund-on-failure, scratch-disk cleanup |
| `order-service` (Go) | Shipment state machine, E.164 and amount validation, PKR formatting, WhatsApp links, team-buy window |
| `apps/mobile` (Flutter) | PKR formatting, feed state and filters, buy flows, rendered widgets |

Jest compiles the sources to CommonJS for tests (`tsconfig.test.json` in each
service) rather than using Jest's experimental ESM support. ts-jest type-checks
every test file, so a test that misuses an API fails to compile.

`@boloshop/db` has no unit tests: it is the migration runner and the connection
pool, both of which need a real Postgres. `make db-migrate` against a live
database is what exercises it.
