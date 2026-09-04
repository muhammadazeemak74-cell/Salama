# @boloshop/api-gateway

The public HTTP surface for BoloShop. The Flutter app talks to this and
nothing else; it owns authentication and reads the catalog through
`@boloshop/db`.

## Layout

```
src/index.ts              startup: DB check, listen, graceful shutdown
src/app.ts                Express app: helmet, CORS, JSON body, routes, errors
src/config.ts             environment, read once and validated at boot
src/errors.ts             HttpError — the one error shape this service speaks
src/validation.ts         shared Zod schemas (E.164, PKR amount, pagination)
src/otp-store.ts          OTP challenges (in-memory — see the warning below)
src/middleware/auth.ts    Bearer JWT verification, role guards
src/middleware/error.ts   404 + centralized error handler
src/routes/health.ts      GET /health
src/routes/auth.ts        POST /api/v1/auth/{request-otp,verify-otp}
src/routes/products.ts    GET, POST /api/v1/products
```

## Running

```bash
cp .env.example .env                              # set JWT_SECRET and DATABASE_URL
npm run migrate --workspace @boloshop/db          # apply the schema
npm run build   --workspace @boloshop/api-gateway
npm run start   --workspace @boloshop/api-gateway
```

`npm run build` and `npm run typecheck` work from a clean checkout, whether run
here or at the monorepo root: this package compiles against `@boloshop/db`'s
emitted `.d.ts`, so a `prebuild` / `pretypecheck` hook builds that dependency
first. A bare `npx tsc --noEmit` skips those hooks and needs
`packages/db/dist` to exist already.

`npm run dev` reloads on change via Node's type stripping.

The process refuses to start without `JWT_SECRET`, and pings PostgreSQL before
binding the port — a pod that cannot reach its database fails immediately
rather than serving errors.

## Endpoints

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | — | 200 when the DB answers, 503 when it does not |
| POST | `/api/v1/auth/request-otp` | — | Issues a code; 429 inside the resend cooldown |
| POST | `/api/v1/auth/verify-otp` | — | Creates or fetches the user, returns a JWT |
| GET | `/api/v1/products` | — | Paginated; `?limit&offset&category&seller_id` |
| POST | `/api/v1/products` | seller | `seller_id` comes from the token, not the body |

Errors are always the same shape, so the client has one branch to write:

```json
{ "error": { "code": "bad_request", "message": "Request validation failed.",
             "details": [{ "path": "phone_number", "message": "..." }] } }
```

## Authentication

Phone number plus one-time code; there is no password anywhere in BoloShop.
`verify-otp` upserts on `users.phone_number` — a returning buyer keeps their
id, role and order history — and returns a 30-day JWT carrying `sub`,
`phone_number` and `role`. Send it as `Authorization: Bearer <token>`;
`authenticate` puts `{ id, phone_number, role }` on `req.user`.

Every OTP failure returns the same 401 regardless of cause. Telling a caller
whether a code exists for a number, or how many guesses remain, hands a
brute-forcer information for free.

### ⚠ Two things must change before this serves real traffic

1. **OTP delivery is mocked.** The code is generated and stored for real, but
   nothing sends an SMS: it is logged, and returned as `dev_otp` outside
   production so the app team can build today. Wire a gateway in
   `routes/auth.ts` — the response shape does not change, `dev_otp` just stops
   appearing.
2. **OTP storage is in-memory.** Correct for one process, wrong for two: a code
   issued by pod A cannot be verified by pod B, and a restart forgets every
   pending code. Move `otp-store.ts` to Redis, which the architecture already
   calls for, before running more than one instance.

## Conventions

- **Money stays a string.** `price_pkr` is `NUMERIC` and arrives as a string
  from `@boloshop/db`; it is passed through untouched. Do not `parseFloat` it.
- **"Active" product means in stock.** `GET /products` filters on
  `stock_quantity > 0` — an unbuyable listing is not worth the bytes on a slow
  connection.
- **Pagination fetches `limit + 1`** to decide `has_more`, rather than running
  a second `COUNT(*)` the client never asked for. Max page size is 50.
- **Ownership comes from the token.** No endpoint accepts a `seller_id` or
  `user_id` in a request body.
