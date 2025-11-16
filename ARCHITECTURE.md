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

## App Bootstrap
- `main.ts`
  - Creates Nest app.
  - Enables global `ValidationPipe` to enforce DTO validation.
  - Registers global `AllExceptionsFilter` for consistent error responses.
  - Registers `LoggingInterceptor` for request logs with duration.
  - Generates OpenAPI document and serves Scalar UI at `/api/docs` using `apiReference`.
  - Listens on `PORT` or 3000.

- `app.module.ts`
  - Loads env configuration via `ConfigModule`.
  - Configures TypeORM with PostgreSQL; entities auto-discovered; `synchronize` disabled in production.
  - Configures Bull (Redis) for queues.
  - Imports `DriversModule`, `RidesModule`, `QueueModule`, `SeedModule`.
  - Registers a global `ApiKeyGuard`. If `API_KEY` is set, every request must include `x-api-key`.

## Configuration
- `src/config/database.config.ts`
  - Exposes database and redis configuration via `registerAs`.
  - Reads host, port, credentials from environment variables.

## Global Layer
- `common/guards/api-key.guard.ts`
  - Enforces optional API key: compares request header against `process.env.API_KEY`.

- `common/interceptors/logging.interceptor.ts`
  - Logs each request method, URL, status code, and elapsed time.

- `common/filters/http-exception.filter.ts`
  - Catches exceptions and returns a JSON payload `{ statusCode, path, timestamp, message }`.

## Data Model
- `drivers/entities/driver.entity.ts`
  - `id`: uuid PK
  - `name`: string (indexed)
  - `status`: enum('available','busy') (indexed)
  - `location`: `geography(Point,4326)` as GeoJSON `Point`
  - `createdAt`, `updatedAt`
  - `rides`: one-to-many relation

- `rides/entities/ride.entity.ts`
  - `id`: uuid PK
  - `userId`: string (indexed)
  - `pickupLat`, `pickupLng`, `pickupAddress`
  - `destinationLat`, `destinationLng`, `destinationAddress`
  - `status`: enum('pending','assigned','accepted','completed','cancelled') (indexed)
  - `driverId`: nullable uuid FK to `drivers(id)`
  - `createdAt`, `updatedAt`

## DTO Validation
- `rides/dto/create-ride.dto.ts`
  - Validates `userId` as string, coordinates as lat/lng, address length.

- `drivers/dto/find-nearby-drivers.dto.ts`
  - Validates query: `lat`, `lng`, optional `limit` with min/max.

## Business Logic
- `rides/rides.service.ts`
  - `createRide` persists the ride with status `pending` and enqueues assignment job.
  - `findById` fetches ride with driver relation.

- `drivers/drivers.service.ts`
  - `findAll` returns all drivers.
  - `findNearby` performs PostGIS distance calculation and `<->` ordering for speed:
    - `ST_SetSRID(ST_MakePoint(:lng,:lat),4326)`
    - `ST_Distance(driver.location, point) / 1000 AS distance_km`
    - Ordered by `driver.location <-> point`.
  - `acceptRide` validates that a ride is not already owned and is in an acceptable state, then marks ride `accepted` and driver `busy`.

## Controllers
- `rides/rides.controller.ts`
  - `POST /rides` → create ride, enqueue assignment.
  - `GET /rides/:id` → ride details with driver.

- `drivers/drivers.controller.ts`
  - `GET /drivers` → list drivers.
  - `GET /drivers/nearby` → nearest available drivers (with distance in km).
  - `POST /drivers/:driverId/accept/:rideId` → accept ride.

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

## PostGIS Queries
- Creating a point from coordinates:
  - `ST_SetSRID(ST_MakePoint(:lng,:lat), 4326)`
- Ordering by distance using KNN index:
  - `driver.location <-> ST_SetSRID(ST_MakePoint(:lng,:lat), 4326)`
- Getting numeric distance in km:
  - `ST_Distance(driver.location, point) / 1000 AS distance_km`

## Database Lifecycle
- `database/migrations/1700000000000-init-schema.ts`
  - Enables `uuid-ossp` and `postgis`.
  - Creates enums, tables, indexes, FK.

- `data-source.ts`
  - TypeORM CLI configuration for migrations (`-d data-source.ts`).

## Seeding
- `database/seeds/seed.service.ts`
  - Truncates `rides` and `drivers` with `CASCADE`.
  - Inserts 20 drivers with random Lagos coordinates (lat 6.5–6.6, lng 3.3–3.4), random availability.

- `database/seeds/run-seed.ts`
  - Bootstraps Nest application context, runs `SeedService`, then exits.

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


