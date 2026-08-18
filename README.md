# FoodXpress

> A production-oriented food delivery platform built around transactional order processing, idempotent payments, real-time delivery tracking, role-based authorization, and cache-aware data access.

FoodXpress is a full-stack food delivery system implemented as a **pnpm workspace monorepo** with a NestJS API and an Expo/React Native mobile application. The platform models three operational roles—**Customer**, **Restaurant Owner**, and **Driver**—and connects them through a shared domain model, REST APIs, Stripe payments, Redis-backed state, and Socket.IO real-time communication.

The project is deliberately designed around the failure modes that make delivery systems interesting: concurrent order updates, stale driver assignments, duplicate payment attempts, webhook retries, price tampering, cache invalidation, reconnecting clients, and authorization across multiple user roles.

---

## Table of Contents

- [Product Overview](#product-overview)
- [Core Capabilities](#core-capabilities)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Monorepo Structure](#monorepo-structure)
- [Domain Model](#domain-model)
- [Order Lifecycle](#order-lifecycle)
- [Authentication & Authorization](#authentication--authorization)
- [Payment Architecture](#payment-architecture)
- [Real-Time Architecture](#real-time-architecture)
- [Caching Strategy](#caching-strategy)
- [Data Integrity & Concurrency](#data-integrity--concurrency)
- [API Surface](#api-surface)
- [Mobile Application](#mobile-application)
- [Environment Configuration](#environment-configuration)
- [Local Development](#local-development)
- [Database Development](#database-development)
- [Testing](#testing)
- [Engineering Trade-offs](#engineering-trade-offs)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)

---

## Product Overview

FoodXpress provides three role-specific experiences over one backend platform.

### Customer

Customers can:

- Create an account and authenticate with JWT.
- Discover restaurants and search by restaurant name or cuisine.
- Browse categories and menu items.
- Maintain a restaurant-scoped shopping cart.
- Place orders.
- Pay through Stripe PaymentIntents.
- Track order status in real time.
- Track an assigned driver's latest location.
- Review completed orders and rate restaurants/drivers.
- View order history.

### Restaurant Owner

Restaurant owners can:

- Create and manage their restaurant.
- Configure restaurant metadata and availability.
- Create, update, and delete menu categories.
- Create, update, and delete menu items.
- View restaurant orders.
- Progress orders through the preparation lifecycle.
- Receive live order updates through Socket.IO.
- View restaurant analytics/history exposed by the mobile experience.

### Driver

Drivers can:

- Toggle online/offline availability.
- Receive assigned delivery orders in real time.
- Accept the operational delivery flow through status transitions.
- Decline a `READY` order and trigger reassignment.
- Update delivery location.
- Move assigned orders through `PICKED_UP` → `DELIVERED`.
- View active and historical deliveries.

---

## Core Capabilities

| Capability | Implementation |
|---|---|
| Authentication | JWT + bcrypt |
| Authorization | Role-based NestJS guards |
| API | NestJS 11 |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Cache / ephemeral state | Redis |
| Payments | Stripe PaymentIntents + webhooks |
| Real-time communication | Socket.IO |
| Mobile | Expo + React Native |
| Navigation | Expo Router |
| Server state | TanStack Query |
| Client state | Zustand |
| File/image uploads | UploadThing |
| Shared contracts | `@food-xpress/types` |
| Local infrastructure | Docker Compose |
| Testing | Jest + Supertest |
| Package management | pnpm workspaces |

---

# Architecture

## High-Level Architecture

```text
                              ┌─────────────────────────────┐
                              │       Expo / React Native    │
                              │                             │
                              │  Customer │ Owner │ Driver  │
                              └──────────────┬──────────────┘
                                             │
                         ┌───────────────────┴──────────────────┐
                         │                                      │
                    REST / JWT                            Socket.IO / JWT
                         │                                      │
                         ▼                                      ▼
                ┌────────────────────────────────────────────────────┐
                │                     NestJS API                       │
                │                                                    │
                │ Auth │ Restaurants │ Menu │ Orders │ Payments     │
                │ Driver │ Location │ Reviews │ WebSocket Gateway   │
                └───────────────┬──────────────────┬─────────────────┘
                                │                  │
                         SQL / Drizzle         Redis commands
                                │                  │
                                ▼                  ▼
                       ┌────────────────┐   ┌────────────────┐
                       │  PostgreSQL 16 │   │     Redis      │
                       │                │   │                │
                       │ Users          │   │ Menu cache     │
                       │ Restaurants    │   │ Restaurant     │
                       │ Menus          │   │ cache          │
                       │ Orders         │   │ Driver location│
                       │ Reviews        │   │                │
                       │ Outbox events  │   │                │
                       └────────────────┘   └────────────────┘
                                │
                                │ Payment API / Webhook
                                ▼
                       ┌────────────────┐
                       │     Stripe     │
                       │ PaymentIntents │
                       └────────────────┘
```

## Architectural Principles

FoodXpress is organized around several engineering principles:

1. **The database is an authority for business invariants.**
2. **The server calculates monetary values rather than trusting clients.**
3. **State transitions are explicit and concurrency-aware.**
4. **External payment operations are idempotent.**
5. **Real-time subscriptions are authorized before room membership.**
6. **Redis accelerates reads and stores hot ephemeral state; PostgreSQL remains the durable system of record.**
7. **Shared TypeScript contracts reduce API/client drift.**
8. **Side effects can be represented transactionally through an outbox model.**

---

# Technology Stack

## Backend

- **NestJS 11** — modular server architecture and dependency injection.
- **TypeScript** — static typing across backend services.
- **Drizzle ORM** — type-safe PostgreSQL access.
- **PostgreSQL 16** — durable relational storage.
- **`pg`** — PostgreSQL connection pool.
- **JWT** — stateless authentication.
- **bcrypt** — password hashing.
- **class-validator / class-transformer** — DTO validation and transformation.
- **Socket.IO** — real-time events and scoped rooms.
- **ioredis** — Redis integration.
- **Stripe SDK** — payment intent creation and webhook verification.
- **UploadThing** — image/file upload integration.

## Mobile

- **Expo**
- **React Native**
- **React 19**
- **Expo Router**
- **TanStack Query**
- **Zustand**
- **Axios**
- **Socket.IO Client**
- **Stripe React Native SDK**
- **Expo Location**
- **React Native Maps**
- **Expo Secure Store**
- **UploadThing Expo SDK**

## Infrastructure

- **pnpm workspaces**
- **Docker Compose**
- **PostgreSQL 16 Alpine**
- **Redis Stack**

---

# Monorepo Structure

```text
FoodXpress/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── db/
│   │   │   │   └── schema/
│   │   │   ├── driver/
│   │   │   ├── gateway/
│   │   │   ├── location/
│   │   │   ├── menu/
│   │   │   ├── orders/
│   │   │   ├── payments/
│   │   │   ├── redis/
│   │   │   ├── restaurant/
│   │   │   ├── reviews/
│   │   │   └── uploadthing/
│   │   └── test/
│   │
│   └── mobile/
│       └── src/
│           ├── app/
│           │   ├── (customer)/
│           │   ├── (driver)/
│           │   └── (owner)/
│           ├── components/
│           ├── context/
│           ├── hooks/
│           ├── lib/
│           └── store/
│
├── packages/
│   └── types/
│       └── index.ts
│
├── docker-compose.yml
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

### Design Rationale

The repository keeps independently deployable application concerns separated while sharing domain contracts through:

```text
packages/types
       │
       ├──────────────► apps/api
       │
       └──────────────► apps/mobile
```

This avoids duplicating critical enums and interfaces such as `UserRole`, `OrderStatus`, `Order`, `MenuItem`, and `CartItem`.

---

# Domain Model

## Users

A single `users` table represents all actors:

```text
                    ┌──────────────┐
                    │    users     │
                    ├──────────────┤
                    │ id           │
                    │ email        │
                    │ password     │
                    │ role         │
                    │ isOnline     │
                    └──────┬───────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
         CUSTOMER      OWNER          DRIVER
```

Roles are represented using a PostgreSQL enum:

```text
CUSTOMER
RESTAURANT_OWNER
DRIVER
```

## Restaurants

An owner has one restaurant in the current model.

```text
users
  │
  │ owner_id
  ▼
restaurants
  │
  ├── menu_categories
  │       │
  │       └── menu_items
  │
  ├── orders
  │
  └── reviews
```

The `owner_id` column is unique, enforcing the one-owner/one-restaurant assumption at the database level.

## Orders

An order connects:

```text
Customer
    │
    ▼
  Order ─────────────► Restaurant
    │
    ├───────────────► Driver
    │
    └───────────────► Order Items
                         │
                         └── Menu Items
```

An order stores a payment intent identifier and an attempt identifier so payment retries can be controlled independently of the order itself.

## Reviews

A review is associated with exactly one order through a unique `order_id`.

The schema also uses composite foreign keys to ensure the customer, restaurant, and driver recorded on the review correspond to the same order.

---

# Order Lifecycle

FoodXpress models the order lifecycle as an explicit state machine.

```text
                    ┌───────────┐
                    │  PENDING  │
                    └─────┬─────┘
                          │
                    Stripe success
                          │
                          ▼
                    ┌───────────┐
                    │ CONFIRMED │
                    └─────┬─────┘
                          │
                          ▼
                    ┌───────────┐
                    │ PREPARING │
                    └─────┬─────┘
                          │
                          ▼
                    ┌───────────┐
                    │   READY   │
                    └─────┬─────┘
                          │
                          ▼
                    ┌───────────┐
                    │ PICKED_UP │
                    └─────┬─────┘
                          │
                          ▼
                    ┌───────────┐
                    │ DELIVERED │
                    └───────────┘
```

Cancellation is permitted from owner-controlled preparation states:

```text
CONFIRMED ─────► CANCELLED
PREPARING ─────► CANCELLED
```

### Role-specific transitions

Restaurant owners control:

```text
CONFIRMED → PREPARING
PREPARING → READY
CONFIRMED → CANCELLED
PREPARING → CANCELLED
```

Drivers control:

```text
READY → PICKED_UP
PICKED_UP → DELIVERED
```

The service rejects transitions that are not explicitly allowed.

---

# Authentication & Authorization

## Authentication Flow

```text
Mobile
  │
  │ POST /api/auth/login
  ▼
NestJS AuthService
  │
  ├── lookup user
  ├── bcrypt.compare()
  └── sign JWT
        │
        ▼
     Mobile
        │
        └── secure token storage
```

The JWT contains:

```ts
{
  sub: user.id,
  email: user.email,
  role: user.role
}
```

The mobile client persists the token through Expo Secure Store and attaches it to API requests through an Axios interceptor.

## Role-Based Authorization

Protected controllers combine:

```text
JwtAuthGuard
      +
RolesGuard
      +
@Roles(...)
```

Example:

```text
POST /api/restaurants
        │
        ▼
JwtAuthGuard
        │
        ▼
RolesGuard
        │
        ▼
RESTAURANT_OWNER
```

Authorization is additionally enforced at the service layer for resource ownership.

For example, being a restaurant owner does not automatically grant access to every restaurant; the service verifies that the requested restaurant belongs to the authenticated owner.

---

# Payment Architecture

Stripe integration is designed around the two biggest payment concerns:

- duplicate payment attempts
- duplicate webhook delivery

## Payment Intent Creation

The flow is:

```text
Customer
   │
   │ POST /payments/intent
   ▼
PaymentsService
   │
   ├── verify order ownership
   ├── verify PENDING status
   │
   ├── SELECT ... FOR UPDATE
   │
   ├── reserve payment attempt ID
   │
   └── create/reuse Stripe PaymentIntent
              │
              └── idempotency key
```

The payment attempt identifier is persisted before the Stripe request.

Stripe receives an idempotency key tied to that attempt:

```text
order-{orderId}-{attemptId}
```

This protects against repeated requests caused by double taps, retries, or transient network failures.

## Webhook Processing

Stripe webhooks are signature-verified using the raw request body.

```text
Stripe
  │
  │ payment_intent.succeeded
  ▼
POST /api/payments/webhook
  │
  ├── verify Stripe signature
  ├── locate order
  ├── ignore already-confirmed order
  │
  └── transaction
        ├── PENDING → CONFIRMED
        └── insert outbox event
```

The confirmation update is guarded by the current status:

```text
WHERE id = orderId
AND status = 'PENDING'
```

Therefore, a repeated webhook does not re-confirm the order or create duplicate downstream work.

---

# Real-Time Architecture

FoodXpress uses a Socket.IO namespace:

```text
/orders
```

The WebSocket connection is authenticated with the same JWT identity model used by REST.

## Connection Authentication

```text
Socket connection
      │
      ▼
JWT verification middleware
      │
      ├── valid → authenticated socket
      │
      └── invalid → connection rejected
```

## Scoped Rooms

The gateway supports:

```text
order:<orderId>
restaurant:<restaurantId>
driver:<driverId>
```

Room membership is not trusted from the client.

Before joining an order room, the server verifies that the authenticated user is:

- the customer who placed the order,
- the owner of the restaurant, or
- the driver assigned to the order.

## Driver Location Flow

```text
Driver App
    │
    │ driver:location
    ▼
Socket.IO Gateway
    │
    ├── validate role
    ├── validate latitude/longitude
    ├── verify driver assignment
    │
    ├── persist latest position in Redis
    │
    └── emit driver:location
              │
              ▼
        order:<orderId>
              │
              ▼
        Customer App
```

Driver coordinates are stored in Redis with a TTL of one hour.

This makes Redis both:

- a low-latency delivery mechanism for the latest position, and
- a recovery source for reconnecting clients.

When a customer joins an order room, the gateway attempts to hydrate the customer with the latest persisted location immediately.

---

# Caching Strategy

Redis is used for read-heavy resources and ephemeral delivery state.

## Restaurant Cache

Individual restaurants use:

```text
restaurant:<id>
restaurant:owner:<ownerId>
```

with a five-minute TTL.

Restaurant listings use a generation-based key:

```text
restaurant:list:<generation>:<search>
```

When a restaurant changes:

```text
INCR restaurant:list:generation
```

Old listing keys become unreachable without scanning Redis.

This avoids an expensive pattern such as:

```text
KEYS restaurant:list:*
DEL ...
```

## Menu Cache

Menu categories:

```text
menu:categories:<restaurantId>
```

Menu items:

```text
menu:items:<restaurantId>
```

Both use a five-minute TTL.

Cache invalidation occurs after menu mutations.

Redis failures on menu reads/writes are treated as cache failures rather than database failures—the database remains authoritative.

## Driver Location

Latest location:

```text
driver:location:<orderId>
```

TTL:

```text
3600 seconds
```

The design intentionally stores the latest coordinate rather than building a high-volume historical location log.

---

# Data Integrity & Concurrency

This is one of the strongest engineering aspects of FoodXpress.

## Server-Side Pricing

The mobile client submits:

```text
menuItemId
quantity
restaurantId
```

The API retrieves the current menu prices from PostgreSQL and calculates:

```text
total = Σ(menuItem.price × quantity)
```

The client-provided total is never trusted.

Each order item also snapshots:

```text
unitPrice
```

so historical orders remain financially consistent after menu prices change.

## Restaurant Boundary Enforcement

The API verifies that all requested menu items belong to the specified restaurant.

The database reinforces this through composite foreign keys:

```text
(order_id, restaurant_id)
        ↓
orders(id, restaurant_id)
```

and:

```text
(menu_item_id, restaurant_id)
        ↓
menu_items(id, restaurant_id)
```

This prevents cross-restaurant order items from becoming valid database state.

## Database Constraints

The schema includes constraints such as:

```text
total_amount >= 0
quantity > 0
unit_price >= 0
retry_count >= 0
```

These protect invariants even if data reaches PostgreSQL through a code path outside the normal service logic.

---

# Optimistic Concurrency for Orders

Order updates use compare-and-set semantics.

Conceptually:

```sql
UPDATE orders
SET status = :newStatus
WHERE id = :orderId
  AND status = :previousStatus;
```

If zero rows are updated, another request changed the order first.

FoodXpress surfaces this as a conflict instead of silently overwriting newer state.

```text
Request A                    Request B
   │                            │
   │ reads PREPARING            │ reads PREPARING
   │                            │
   │ UPDATE → READY             │
   │ succeeds                   │
   │                            │
   │                            │ UPDATE → READY
   │                            │ fails because state changed
   │                            │
   │                            └── 409 Conflict
```

---

# Driver Reassignment Concurrency

Driver decline handling is transactional.

The service guards the assignment removal with:

```text
WHERE order_id = ?
AND driver_id = ?
AND status = READY
```

This protects against a stale decline request clearing a newer driver's assignment.

The reassignment is then performed in the same transaction while excluding the declining driver.

```text
READY order
    │
    ▼
Driver A assigned
    │
    ├── Driver A declines
    │
    ▼
transaction
    │
    ├── verify A still owns assignment
    ├── clear A
    ├── find another online driver
    └── assign Driver B
```

---

# Transactional Outbox

The schema includes an `outbox_events` table.

Events such as:

```text
order.ready
order.updated
```

are written within the same transaction as the state mutation that produced them.

```text
┌─────────────────────────────┐
│ PostgreSQL Transaction      │
│                             │
│ UPDATE orders               │
│ INSERT outbox_events        │
│                             │
│ COMMIT                      │
└─────────────────────────────┘
```

This provides a durable foundation for future consumers such as:

- push notifications
- analytics
- dispatch workers
- email/SMS
- event streaming

The current implementation establishes the transactional outbox data model; a dedicated background consumer is a future extension.

---

# API Surface

All HTTP routes are prefixed with:

```text
/api
```

## Authentication

| Method | Endpoint | Access |
|---|---|---|
| `POST` | `/auth/register` | Public |
| `POST` | `/auth/login` | Public |
| `GET` | `/auth/me` | Authenticated |

## Restaurants

| Method | Endpoint | Access |
|---|---|---|
| `GET` | `/restaurants` | Authenticated |
| `GET` | `/restaurants/:id` | Authenticated |
| `GET` | `/restaurants/mine` | Restaurant Owner |
| `POST` | `/restaurants` | Restaurant Owner |
| `PATCH` | `/restaurants/:id` | Restaurant Owner |

## Menu

| Method | Endpoint | Access |
|---|---|---|
| `GET` | `/menu/categories/:restaurantId` | Public |
| `POST` | `/menu/categories` | Restaurant Owner |
| `PATCH` | `/menu/categories/:id` | Restaurant Owner |
| `DELETE` | `/menu/categories/:id` | Restaurant Owner |
| `GET` | `/menu/items/:restaurantId` | Public |
| `POST` | `/menu/items` | Restaurant Owner |
| `PATCH` | `/menu/items/:id` | Restaurant Owner |
| `DELETE` | `/menu/items/:id` | Restaurant Owner |

## Orders

| Method | Endpoint | Access |
|---|---|---|
| `POST` | `/orders` | Customer |
| `GET` | `/orders/mine` | Customer / Driver |
| `GET` | `/orders/restaurant` | Restaurant Owner |
| `GET` | `/orders/:id` | Involved party |
| `PATCH` | `/orders/:id/status` | Owner / Driver |

## Payments

| Method | Endpoint | Access |
|---|---|---|
| `POST` | `/payments/intent` | Customer |
| `POST` | `/payments/webhook` | Stripe |

## Driver

| Method | Endpoint | Access |
|---|---|---|
| `PATCH` | `/driver/online` | Driver |
| `GET` | `/driver/status` | Driver |
| `POST` | `/driver/orders/:id/decline` | Driver |

## Location

| Method | Endpoint | Access |
|---|---|---|
| `GET` | `/location/:orderId` | Authorized order participant |

## Reviews

| Method | Endpoint | Access |
|---|---|---|
| `POST` | `/reviews` | Customer |
| `GET` | `/reviews/restaurant/:restaurantId` | Authenticated |
| `GET` | `/reviews/restaurant/:restaurantId/average` | Authenticated |
| `GET` | `/reviews/driver/:driverId/average` | Authenticated |
| `GET` | `/reviews/order/:orderId/status` | Customer |

---

# WebSocket Events

Namespace:

```text
/orders
```

## Client → Server

| Event | Purpose |
|---|---|
| `join:order` | Subscribe to a specific order |
| `join:restaurant` | Subscribe to restaurant order updates |
| `join:driver` | Subscribe to driver's assignment room |
| `driver:location` | Submit driver's latest coordinates |

## Server → Client

| Event | Purpose |
|---|---|
| `order:updated` | Order status/data changed |
| `driver:location` | Latest driver coordinates |
| `driver:assigned` | New delivery assigned to driver |

---

# Mobile Application

The mobile application uses Expo Router's route groups to isolate role-specific experiences.

```text
src/app/
├── (customer)/
│   └── ...
├── (driver)/
│   └── ...
└── (owner)/
    └── ...
```

## Customer Experience

Key screens include:

```text
Home
Search
Restaurant Details
Cart
Orders
Order Details
Profile
```

The customer flow integrates:

- restaurant discovery
- menu browsing
- restaurant-scoped cart
- checkout
- payment
- order tracking
- driver location
- reviews

## Driver Experience

```text
Driver Home
Active Delivery
Delivery History
Driver Profile
```

The driver client uses:

- online/offline status
- Socket.IO assignment events
- live location reporting
- delivery state transitions

## Restaurant Owner Experience

```text
Restaurant Dashboard
Create Restaurant
Edit Restaurant
Menu Management
Analytics
Profile
```

Owners receive live order changes through restaurant-specific Socket.IO rooms.

---

# Client State Architecture

FoodXpress deliberately separates state categories.

## Server State

**TanStack Query**

Used for API-backed data such as:

- restaurants
- menus
- orders
- reviews
- driver status

## Local Client State

**Zustand**

Used for the shopping cart.

The cart tracks:

```text
items
restaurantId
restaurantName
```

This is important because FoodXpress intentionally models the cart as belonging to **one restaurant at a time**.

Adding an item from another restaurant requires the UI flow to confirm replacement of the existing cart.

## Authentication State

A dedicated React context manages:

```text
user
token
isLoading
login()
register()
logout()
```

Tokens are persisted using Expo Secure Store.

---

# Environment Configuration

The repository contains environment templates for local configuration.

Typical backend variables include:

```env
DATABASE_URL=postgresql://postgres:<password>@127.0.0.1:5432/mydatabase
JWT_SECRET=<strong-secret>

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

STRIPE_SECRET_KEY=<stripe-secret>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>

UPLOADTHING_TOKEN=<uploadthing-token>
```

The mobile application expects environment variables such as:

```env
EXPO_PUBLIC_API_URL=http://<host>:3000/api
EXPO_PUBLIC_SERVER_URL=http://<host>:3000

GOOGLE_MAPS_API_KEYS=<google-maps-key>
```

> Never commit real credentials. Use `.env` files locally and secret management in deployment environments.

---

# Local Development

## Prerequisites

Install:

- Node.js
- pnpm
- Docker
- Docker Compose
- Expo-compatible development environment

The repository declares pnpm `^11.9.0` as its package-manager expectation.

## 1. Clone

```bash
git clone <your-repository-url>
cd FoodXpress
```

## 2. Install Dependencies

```bash
pnpm install
```

## 3. Configure Environment

Create the required environment files from the repository's templates and provide local credentials.

At minimum, configure:

```text
PostgreSQL
JWT
Redis
Stripe
UploadThing
Expo API URL
```

## 4. Start Infrastructure

```bash
docker compose up -d
```

This starts:

```text
PostgreSQL → 127.0.0.1:5432
Redis      → 127.0.0.1:6379
Redis UI   → 127.0.0.1:8001
```

## 5. Push Database Schema

```bash
pnpm --filter api db:push
```

## 6. Start the API

```bash
pnpm dev:api
```

The NestJS API defaults to:

```text
http://localhost:3000/api
```

## 7. Start Mobile

```bash
pnpm dev:mobile
```

Or run the workspace applications together:

```bash
pnpm dev
```

---

# Database Development

FoodXpress uses Drizzle ORM for schema management.

## Push Schema

```bash
pnpm --filter api db:push
```

## Drizzle Studio

```bash
pnpm --filter api db:studio
```

This is useful for inspecting:

- users
- restaurants
- menu categories
- menu items
- orders
- order items
- reviews
- outbox events

---

# Testing

The API uses Jest for unit testing and Supertest for end-to-end testing.

## Unit Tests

```bash
pnpm --filter api test
```

## Watch Mode

```bash
pnpm --filter api test:watch
```

## Coverage

```bash
pnpm --filter api test:cov
```

## End-to-End Tests

```bash
pnpm --filter api test:e2e
```

## Concurrency-Critical Test Areas

Testing is particularly valuable around:

- order status transitions
- payment intent creation
- Stripe webhook processing
- driver reassignment
- location authorization
- cache failure behavior

These are higher-risk paths than simple CRUD operations because correctness depends on ordering, retries, or concurrent requests.

---

# Engineering Trade-offs

## Redis for Latest Driver Location

The system stores the latest location rather than a full GPS history.

### Benefits

- predictable memory usage
- low-latency reads/writes
- simple reconnect behavior
- no high-frequency relational writes

### Trade-off

Historical route reconstruction is not available from the current location store.

A future implementation could introduce a separate telemetry pipeline for historical coordinates.

---

## Single-Candidate Driver Assignment

The current dispatcher selects an online driver rather than calculating the optimal driver based on:

- distance
- ETA
- workload
- driver rating
- zone
- delivery capacity

This keeps the domain model focused while leaving a clear seam for a future dispatch engine.

---

## Transactional Outbox Without a Consumer

The outbox table provides durable event capture, but the repository does not currently include a worker responsible for draining those events.

The architecture is therefore prepared for asynchronous processing without pretending that the asynchronous processing layer already exists.

---

## One Restaurant per Owner

The schema currently enforces:

```text
users 1 ───── 1 restaurants
```

through a unique `owner_id`.

This is appropriate for the current product model but would need to become:

```text
users 1 ───── N restaurants
```

for restaurant groups or multi-location operators.

---

# Known Limitations

The current implementation is production-shaped rather than a complete production deployment.

Known limitations include:

1. **Driver dispatch is not proximity-aware.**
   The first available online driver can be selected.

2. **The transactional outbox has no background consumer yet.**
   Events are persisted but not drained by a dedicated worker.

3. **No automated refund workflow is implemented.**
   Stripe payment confirmation exists, but a complete cancellation/refund lifecycle is still a future concern.

4. **Restaurant ownership is currently one-to-one.**

5. **Location history is not retained.**
   Redis stores only the latest known location.

6. **No dedicated notification service exists yet.**
   The outbox model provides a foundation for adding one.

7. **No production deployment manifests are included.**
   Docker Compose is primarily a local development environment.

---

# Roadmap

## Dispatch

- [ ] Proximity-aware driver matching.
- [ ] Redis GEO or PostGIS-based driver indexing.
- [ ] Driver workload balancing.
- [ ] Assignment timeout and escalation.
- [ ] Driver acceptance/expiry workflow.

## Events

- [ ] Implement an outbox worker.
- [ ] Add retry/backoff policies.
- [ ] Add dead-letter handling.
- [ ] Publish domain events to a message broker if scale requires it.

## Payments

- [ ] Implement cancellation refunds.
- [ ] Add payment reconciliation.
- [ ] Add payment failure recovery.
- [ ] Track payment lifecycle independently from order lifecycle.

## Observability

- [ ] Structured logging.
- [ ] Metrics.
- [ ] Distributed tracing.
- [ ] Error monitoring.
- [ ] Database/Redis health dashboards.

## Platform

- [ ] Production container images.
- [ ] CI/CD pipeline.
- [ ] Database migration pipeline.
- [ ] Horizontal API scaling.
- [ ] Redis high availability.
- [ ] Secrets management.
- [ ] Production environment configuration.

---

# Engineering Summary

FoodXpress is more than a CRUD food-delivery application. Its architecture intentionally focuses on the failure modes that appear once multiple actors, external systems, and concurrent requests interact.

The strongest architectural decisions are:

```text
                    ┌────────────────────────────┐
                    │       FoodXpress            │
                    ├────────────────────────────┤
                    │                            │
                    │  Server-side pricing       │
                    │  Role-based authorization │
                    │  Explicit state machine   │
                    │  Optimistic concurrency    │
                    │  Stripe idempotency        │
                    │  Webhook verification      │
                    │  Transactional outbox      │
                    │  Composite FKs             │
                    │  Redis caching             │
                    │  Live driver tracking      │
                    │  Scoped WebSocket rooms    │
                    │  Shared TypeScript types   │
                    │                            │
                    └────────────────────────────┘
```

The result is a codebase that demonstrates practical backend engineering concerns across **distributed state, transactional integrity, real-time systems, payment reliability, authorization, caching, and mobile application architecture**—while keeping the domain modular enough to evolve toward a larger production system.

---

## License

