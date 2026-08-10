# FoodXpress

A production-shaped food delivery platform — NestJS API, Expo/React Native mobile client, Postgres, and Redis, wired together in a pnpm/Turborepo monorepo. Built to model the actual hard parts of a delivery system: consistent order state under concurrent writers, real-time driver tracking, and payment flows that don't double-charge or double-fulfill.

This README documents the system as an engineer joining the project would want it documented — what's here, why it's built this way, and where the sharp edges are.

## Table of contents

- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Domain model](#domain-model)
- [Engineering highlights](#engineering-highlights)
- [Real-time layer](#real-time-layer)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [API surface](#api-surface)
- [Testing](#testing)
- [Known limitations / roadmap](#known-limitations--roadmap)

## Architecture

```
┌─────────────────┐        REST (JWT)        ┌──────────────────────┐
│  Expo / RN app   │ ───────────────────────▶ │      NestJS API      │
│  (customer /     │                          │                      │
│   driver /       │ ◀──────────────────────  │  Auth · Orders ·     │
│   owner roles)   │      Socket.IO (JWT)      │  Menu · Payments ·   │
└─────────────────┘                          │  Driver · Location    │
                                              └──────────┬────────────┘
                                                          │
                                     ┌────────────────────┼────────────────────┐
                                     ▼                    ▼                    ▼
                              ┌───────────┐        ┌────────────┐      ┌─────────────┐
                              │ Postgres  │        │   Redis    │      │   Stripe    │
                              │ (Drizzle) │        │ (live geo, │      │ (payment    │
                              │           │        │  listing   │      │  intents,   │
                              │           │        │  cache)    │      │  webhooks)  │
                              └───────────┘        └────────────┘      └─────────────┘
```

One codebase, three client experiences: the mobile app is role-gated at the router level into `(customer)`, `(driver)`, and `(owner)` route groups via Expo Router, each hitting the same API with a JWT that carries `role` in its claims.

## Tech stack

**API** — NestJS 11, Drizzle ORM (`node-postgres` driver) over Postgres 16, `ioredis`, Socket.IO via `@nestjs/websockets`, Stripe SDK, `class-validator`/`class-transformer` for DTO validation, JWT auth (`@nestjs/jwt`).

**Mobile** — Expo (React Native 0.86, React 19), Expo Router (file-based, group-based role routing), TanStack Query for server state, Zustand for client state, `socket.io-client` for live tracking, Stripe React Native SDK, UploadThing for image uploads.

**Infra** — pnpm workspaces + Turborepo-style monorepo layout, Docker Compose for local Postgres + Redis (`redis/redis-stack` for RedisInsight during development), shared `@food-xpress/types` package for cross-boundary type safety between API and mobile.

## Domain model

Three roles — `CUSTOMER`, `RESTAURANT_OWNER`, `DRIVER` — share one `users` table, differentiated by a Postgres enum and enforced by a `RolesGuard` on every role-scoped endpoint.

The schema (Drizzle, `apps/api/src/db/schema/`) leans on the database to enforce invariants an application layer would otherwise have to police by hand:

- **`orders` / `order_items`** — `order_items` carries a *composite* foreign key on `(order_id, restaurant_id)` and `(menu_item_id, restaurant_id)`, not just `order_id`. This closes off a real integrity gap: without it, nothing stops an order item from referencing a menu item belonging to a *different* restaurant than the order itself — the FK makes that state unrepresentable rather than something the service layer has to remember to check.
- **CHECK constraints** on money and quantity columns (`total_amount >= 0`, `unit_price >= 0`, `quantity > 0`, `retry_count >= 0`) — a last line of defense against bad writes that bypass the ORM (migrations, manual fixes, future code paths).
- **`driver_locations`** — one row per order (`unique` on `order_id`), acting as an upsert target for live position rather than an append-only log; the hot path stays O(1) per write.
- **`outbox_events`** — an outbox table for status-change side effects (`order.ready`, `order.updated`), written in the same transaction as the state change it describes, so a driver-assignment job or notification worker can poll it without racing the write that triggered it.

## Engineering highlights

A few decisions worth calling out, because they're the parts of a delivery app that are easy to get wrong:

**Server-side pricing, always.** `OrdersService.create` recomputes the order total from menu item prices fetched fresh from the DB — the client's cart total is never trusted. Each `order_item` also snapshots `unit_price` at creation time, so a later menu price change doesn't retroactively change the price of a historical order.

**Optimistic concurrency on status transitions.** `updateStatus` reads the current status, validates the transition is legal for the caller's role via an explicit state machine (`ownerTransitions` / `driverTransitions` maps), then updates with `WHERE id = ? AND status = ?`. A `0`-row update means someone else changed the status first — that's surfaced as a `409 ConflictException`, not silently overwritten.

**Payment intents are idempotent and row-locked.** `PaymentsService.createPaymentIntent` takes a `SELECT ... FOR UPDATE` on the order row inside a transaction before touching Stripe, generates a stable idempotency key per payment *attempt* (not per request), and passes that key to Stripe's API. Retried requests — double-taps, flaky networks — resolve to the same Stripe payment intent instead of creating duplicate charges. The Stripe webhook handler mirrors this: signature-verified, and the `CONFIRMED` transition is itself guarded by `WHERE status = 'PENDING'`, so a redelivered webhook (Stripe's own retry policy) is a no-op instead of a double-fulfillment.

**Driver reassignment races are closed in the DB, not the app.** `declineOrder` runs the "clear this driver, find another" logic inside one transaction, guarding the clear with `WHERE driver_id = ? AND status = 'READY'`. If the order was already reassigned by a concurrent process before this decline lands, the guarded update affects zero rows and the decline is rejected as stale — it can't stomp on a newer assignment.

**Cache invalidation via generation counter, not key scanning.** `RestaurantsService` caches restaurant listings in Redis but avoids the classic `KEYS restaurant:list:*` + `DEL` pattern (an O(n) blocking scan in production Redis). Instead, a `restaurant:list:generation` counter is bumped on every write, and it's baked into the cache key itself — every previously-cached listing becomes unaddressable in one atomic `INCR`, no scan required.

**Authorization is centralized, not sprinkled.** Order/location access control ("can this JWT see this order?") is the same three-way role check — customer owns it, owner's restaurant owns it, driver is assigned to it — reused across the REST controller, the WebSocket gateway, and the location service. Unauthorized and not-found both return `404`, deliberately, so the API doesn't leak whether an order ID exists to someone who isn't party to it.

## Real-time layer

Driver tracking runs over a namespaced Socket.IO gateway (`/orders`), authenticated with the same JWT used for REST — verified once in a connection middleware (`afterInit`), not per-event.

- Clients join scoped rooms (`order:<id>`, `restaurant:<id>`, `driver:<id>`) only after a server-side authorization check, mirroring the REST access rules.
- Driver location updates are validated (finite numbers, lat/lng range) before being persisted to Redis with a 1-hour TTL and fanned out to the order's room.
- Redis is the source of truth for "last known position," not just a pub/sub relay — a customer who reconnects mid-delivery is hydrated with the last persisted location on `join:order`, instead of staring at a blank map until the next tick.

## Getting started

**Prerequisites:** Node.js, pnpm `^11.9.0`, Docker.

```bash
# 1. Clone and install
git clone <repo-url> && cd FoodXpress
pnpm install

# 2. Environment
cp .env.example .env
# set POSTGRES_PASSWORD in .env
cp apps/api/.env.example apps/api/.env   # DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY, etc.

# 3. Infra
docker compose up -d          # Postgres 16 + redis-stack (RedisInsight on :8001)

# 4. Schema
pnpm --filter api db:push     # drizzle-kit push

# 5. Run
pnpm dev:api                  # NestJS on :3000 (prefix: /api)
pnpm dev:mobile               # Expo, --android by default
# or both:
pnpm dev
```

`pnpm --filter api db:studio` opens Drizzle Studio against the local database if you want a GUI while iterating on the schema.

## Project structure

```
FoodXpress/
├── apps/
│   ├── api/                  # NestJS backend
│   │   └── src/
│   │       ├── auth/         # JWT auth, roles guard, register/login
│   │       ├── orders/       # order lifecycle, state machine, pricing
│   │       ├── payments/     # Stripe intents + webhook handling
│   │       ├── driver/       # online status, assignment, decline/reassign
│   │       ├── location/     # Redis-backed live position, authorized reads
│   │       ├── gateway/      # Socket.IO gateway (rooms, auth, broadcasts)
│   │       ├── restaurant/   # restaurant CRUD, cached listings
│   │       ├── menu/         # categories + items
│   │       ├── reviews/      # post-delivery ratings
│   │       ├── redis/        # global Redis provider
│   │       └── db/           # Drizzle schema + connection
│   └── mobile/                # Expo Router app
│       └── src/app/
│           ├── (customer)/    # browse, cart, order tracking
│           ├── (driver)/      # online toggle, active delivery, history
│           └── (owner)/       # restaurant + menu management, analytics
├── packages/
│   └── types/                 # @food-xpress/types — shared across api + mobile
└── docker-compose.yml          # Postgres + Redis for local dev
```

## API surface

All routes are prefixed `/api` and (except auth) require a `Bearer` JWT. Role-restricted routes are guarded with `@Roles(...)` + `RolesGuard`.

| Domain | Examples |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login` |
| Restaurants | `GET /restaurants`, `POST /restaurants` *(owner)*, `PATCH /restaurants/:id` *(owner)* |
| Menu | `POST /menu/categories`, `POST /menu/items`, `PATCH /menu/items/:id` |
| Orders | `POST /orders`, `GET /orders/me`, `GET /orders/:id`, `PATCH /orders/:id/status` |
| Payments | `POST /payments/intent`, `POST /payments/webhook` *(Stripe signature-verified)* |
| Driver | `PATCH /driver/online`, `GET /driver/status`, `POST /driver/orders/:id/decline` |
| Location | `GET /location/:orderId` *(role-authorized live position)* |
| Reviews | `POST /reviews` |

Real-time (Socket.IO, namespace `/orders`): `join:order`, `join:restaurant`, `join:driver`, `driver:location` (client → server), `order:updated`, `driver:location`, `driver:assigned` (server → client).

## Testing

```bash
pnpm --filter api test        # unit tests (Jest)
pnpm --filter api test:e2e    # e2e
pnpm --filter api test:cov    # coverage
```

Unit coverage focuses on the concurrency-sensitive paths — order status transitions under conflicting writes, payment intent creation, and location authorization — rather than chasing blanket coverage on CRUD glue.

## Known limitations / roadmap

- **Driver assignment is single-candidate, not proximity-based.** `assignDriver` grabs the first online driver rather than the nearest one — fine for a single-city demo, not for a real dispatch problem. Geospatial matching (PostGIS or a Redis geo index against the same coordinates already being tracked) is the natural next step.
- **Outbox events are written but not yet consumed.** `outbox_events` rows are inserted transactionally on `order.ready` / `order.updated`, but there's no worker draining them yet — the pattern is in place for reliable event dispatch (push notifications, analytics) without a consumer wired up.
- **No refund flow.** Payment capture and webhook confirmation are handled; cancellations after payment currently need a manual Stripe-side refund.
- **Single restaurant per owner.** The schema and service layer assume a 1:1 owner-to-restaurant relationship (enforced via a `unique` constraint on `owner_id`); multi-location owners aren't modeled yet.
