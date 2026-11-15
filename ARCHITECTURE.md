# Architecture and System Overview

## Purpose
This document explains the complete ride‑hailing backend: structure, modules, data model, queues, configuration, validation, error handling, database migrations, seeding, and how requests flow through the system.

## High-Level Components
- HTTP API built with NestJS
- PostgreSQL with PostGIS for geospatial data and distance queries
- TypeORM for data access and migrations
- Redis + Bull for background job processing (ride assignment)
- OpenAPI with Scalar UI at /api/docs

## Directory Structure
```
src/
  app.module.ts
  main.ts
  config/
    database.config.ts
  common/
    filters/http-exception.filter.ts
    guards/api-key.guard.ts
    interceptors/logging.interceptor.ts
  modules/
    drivers/
      drivers.controller.ts
      drivers.module.ts
      drivers.service.ts
      dto/find-nearby-drivers.dto.ts
      entities/driver.entity.ts
      enums/driver-status.enum.ts
    rides/
      rides.controller.ts
      rides.module.ts
      rides.service.ts
      dto/create-ride.dto.ts
      entities/ride.entity.ts
      enums/ride-status.enum.ts
    queue/
      constants/queue.constants.ts
      queue.module.ts
      queue.processor.ts
      queue.service.ts
  database/
    migrations/1700000000000-init-schema.ts
    seeds/
      seed.module.ts
      seed.service.ts
      run-seed.ts
data-source.ts
```

## App Bootstrap (why each exists, what it does)
- `main.ts`
  - Creates the Nest application instance. This is the single entry point.
  - Applies a global `ValidationPipe` so all incoming payloads are validated against DTOs. Prevents invalid types/fields from reaching services.
  - Registers `AllExceptionsFilter` globally to standardize error responses and avoid leaking stack traces to clients.
  - Adds `LoggingInterceptor` to log request metadata and latency for basic observability without extra code in controllers.
  - Generates an OpenAPI spec from decorators and serves Scalar API Reference at `/api/docs` so you can explore/test endpoints quickly.
  - Starts the HTTP server on `PORT` from the environment for easy configuration across environments.

- `app.module.ts`
  - Central module that wires configuration, database, queue, and feature modules.
  - `ConfigModule.forRoot` loads `.env` and exposes config values through dependency injection.
  - `TypeOrmModule.forRootAsync` connects to PostgreSQL; loads all `*.entity.ts` automatically; keeps `synchronize` off for safety (we use migrations).
  - `BullModule.forRootAsync` connects to Redis so background jobs can be queued/processed.
  - Imports feature modules: `DriversModule`, `RidesModule`, and `QueueModule`, plus `SeedModule` for CLI seeding.
  - Registers `ApiKeyGuard` as a global guard. If `API_KEY` is set, every request must provide `x-api-key`; if not set, guard allows all traffic. This keeps runtime simple while enabling basic protection when desired.

## Configuration
- `src/config/database.config.ts`
  - Encapsulates database and redis settings behind Nest’s config system. This keeps `app.module.ts` clean and enforces a single source of truth for env values.

## Global Layer
- `common/guards/api-key.guard.ts`
  - Looks for an API key in headers and checks it against `API_KEY`. Off by default if no env var is set. Useful for demos/interviews while still making tests repeatable.

- `common/interceptors/logging.interceptor.ts`
  - Logs method, URL, status code, and duration. Helps identify slow endpoints and verify traffic flow in development without external tooling.

- `common/filters/http-exception.filter.ts`
  - Converts thrown errors into consistent JSON responses. Clients always receive predictable shape: `statusCode`, `path`, `timestamp`, and `message`.

## Data Model
- `drivers/entities/driver.entity.ts`
  - Fields
    - `id`: primary key (uuid) for uniqueness and easy client generation.
    - `name`: indexed for potential lookup/testing.
    - `status`: enum to enforce valid values (`available`, `busy`), indexed for fast filtering.
    - `location`: PostGIS `geography(Point,4326)` to store real-world coordinates (WGS84). Typed as GeoJSON `Point` in code.
    - `createdAt`/`updatedAt`: automatic timestamps for auditing.
    - Relation: one-to-many with rides so ORM can navigate from driver to its rides.
  - Why geography: distance math is accurate on earth’s surface; allows KNN `<->` ordering and `ST_Distance`.

- `rides/entities/ride.entity.ts`
  - Fields
    - `id`: uuid PK.
    - `userId`: indexed for fetching user history later.
    - `pickupLat`/`pickupLng` + address: source location storage for visibility and distance calculations.
    - `destinationLat`/`destinationLng` + address: destination details for UI/receipt.
    - `status`: enum enforcing progression through states.
    - `driverId`: nullable foreign key for assignment.
    - Timestamps.
  - Why denormalized coords: makes assignment logic simpler and avoids joins for pickup point.

## DTO Validation
- `rides/dto/create-ride.dto.ts`
  - Guarantees well-formed ride creation payloads (types, bounds), reducing defensive code in services.

- `drivers/dto/find-nearby-drivers.dto.ts`
  - Ensures nearby search queries are valid (lat/lng semantics, reasonable limits).

## Business Logic
- `rides/rides.service.ts`
  - `createRide`: persists a `pending` ride, then enqueues a background assignment job so the HTTP request returns fast and assignment is resilient to spikes.
  - `findById`: loads a ride (with driver relation) for detail views.

- `drivers/drivers.service.ts`
  - `findAll`: simple listing endpoint for admin/testing.
  - `findNearby`: builds a PostGIS point from query, adds `distance_km` via `ST_Distance`, and uses KNN `<->` ordering to return true nearest drivers efficiently. Limits to a caller-provided or default count.
  - `acceptRide`: guards against race conditions by checking state and ownership before updating ride to `accepted` and driver to `busy`.

## Controllers
- `rides/rides.controller.ts`
  - Thin layer that validates inputs and delegates to services:
    - `POST /rides`: creates and enqueues.
    - `GET /rides/:id`: fetches details.

- `drivers/drivers.controller.ts`
  - Endpoints:
    - `GET /drivers`: list drivers for visibility/testing.
    - `GET /drivers/nearby`: geospatial nearest search.
    - `POST /drivers/:driverId/accept/:rideId`: driver accepts ride, applying service validations.

## Queue System (Bull + Redis)
- `queue/constants/queue.constants.ts`
  - `RIDE_ASSIGNMENT_QUEUE` name.

- `queue/queue.service.ts`
  - `enqueueRideAssignment(rideId)`:
    - Adds job `assign` with 2 attempts and 10s fixed backoff.
    - `removeOnComplete: true` for cleanliness.

- `queue/queue.processor.ts`
  - `@Process('assign') handleRideAssignment`:
    - Loads the ride; if not found or not `pending`, skip.
    - Finds nearest `available` driver by ordering on `<->` using a point made from pickup lat/lng.
    - Uses a DB transaction to:
      - Update `rides`: set `driverId` and status `assigned`.
      - Update `drivers`: set status `busy`.
  - `@OnQueueFailed handleFailed`:
    - After final attempt, resets ride to `pending` and `driverId` to null; logs failure.
  - Why a queue: decouples assignment from the HTTP lifecycle, enabling retries, smoothing bursts, and avoiding long request times.

## PostGIS Queries
- Creating a point from coordinates:
  - `ST_SetSRID(ST_MakePoint(:lng,:lat), 4326)`
- Ordering by distance using KNN index:
  - `driver.location <-> ST_SetSRID(ST_MakePoint(:lng,:lat), 4326)`
- Getting numeric distance in km:
  - `ST_Distance(driver.location, point) / 1000 AS distance_km`
- Why `<->` ordering: leverages index-assisted nearest-neighbor search for speed; `ST_Distance` is still selected to present a human-friendly value.

## Database Lifecycle
- `database/migrations/1700000000000-init-schema.ts`
  - Enables `uuid-ossp` and `postgis`.
  - Creates enums, tables, indexes, FK.
  - Why migrations: safe, repeatable schema changes across environments; prevents accidental destructive syncs.

- `data-source.ts`
  - TypeORM CLI configuration for migrations (`-d data-source.ts`).
  - Exported as a single `DataSource` to satisfy CLI expectations.

## Seeding
- `database/seeds/seed.service.ts`
  - Truncates `rides` and `drivers` with `CASCADE`.
  - Inserts 20 drivers with random Lagos coordinates (lat 6.5–6.6, lng 3.3–3.4), random availability.
  - Why random: produces realistic distribution for nearby search demos.

- `database/seeds/run-seed.ts`
  - Bootstraps Nest application context, runs `SeedService`, then exits.
  - Uses the real application DI graph so repositories and configs are identical to runtime.

## API Documentation
- OpenAPI is generated from controllers and DTOs.
- Scalar UI served at `/api/docs` with theme and layout.
- If an API key is configured, add `x-api-key` header to test requests.

## Environment
- `.env`
  - `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`
  - `REDIS_HOST`, `REDIS_PORT`
  - `PORT`, `NODE_ENV`
  - `API_KEY` (optional)
  - Why `.env.example`: communicates required settings to other developers/CI without committing secrets.

## NPM Scripts
- `start:dev`: Start Nest in watch mode.
- `migration:generate`: Generate a migration with the current models.
- `migration:run`: Run migrations.
- `db:drop`: Drop schema.
- `db:reset`: Drop → migrate → seed.
- `seed`: Run database seeders.

## Request Flow (End-to-End)
1. Client calls `POST /rides` with pickup/destination details.
2. Ride is stored as `pending`; a job is enqueued in `ride-assignment`.
3. Processor selects the nearest `available` driver and assigns the ride; driver becomes `busy`.
4. Driver confirms via `POST /drivers/:driverId/accept/:rideId`; ride becomes `accepted`.
5. Observability and errors are handled globally, and docs are viewable at `/api/docs`.

## Why the folders are structured this way
- `modules/*`: Feature-oriented boundaries (drivers, rides, queue) keep controllers/services/entities together, supporting incremental growth and independent testing.
- `common/*`: Cross-cutting concerns (auth, logging, error handling) that apply application-wide live here to avoid duplication.
- `config/*`: Central place for environment-driven settings prevents scattering env reads throughout code.
- `database/*`: Migrations and seeds are close to the domain but isolated from runtime logic to avoid accidental coupling.
- Root `data-source.ts`: kept outside `src` to work smoothly with TypeORM CLI and avoid bundling it into the application build.

## Where to add/extend things
- New endpoints: add DTOs → controller routes → service methods inside the relevant feature module.
- New background tasks: add a new queue name, service method to enqueue, and a processor handler.
- More ride states: extend `RideStatus` enum and update service/processor logic accordingly.
- Auth: replace `ApiKeyGuard` with a real auth strategy (JWT/session) under `common/guards` and wire it in `app.module.ts`.


