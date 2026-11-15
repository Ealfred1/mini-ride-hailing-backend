# Mini Ride-Hailing Backend

Production-ready NestJS backend for a simplified ride-hailing platform. It exposes ride creation and tracking APIs, driver discovery and acceptance flows, and an automated assignment worker powered by Bull + Redis and PostGIS distance queries.

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ with PostGIS extension
- Redis 7+
- Optional: Docker + Docker Compose for local services

## Setup

```bash
npm install
cp .env.example .env
# update .env with local credentials (API_KEY optional)
```

### Database & Seeds

```bash
npm run migration:run
npm run seed
```

Reset everything at once:

```bash
npm run db:reset
```

### Local Services via Docker (bonus)

```bash
docker-compose up -d
```

This starts PostGIS and Redis on the default ports defined in `.env.example`.

## Running the App

```bash
npm run start:dev
```

API base URL: `http://localhost:3000`

Scalar reference UI: `http://localhost:3000/api/docs`

## API Highlights

- `POST /rides` – create a ride request
- `GET /rides/:id` – fetch ride details with driver info
- `GET /drivers` – list drivers and statuses
- `GET /drivers/nearby` – nearest available drivers ordered by PostGIS distance
- `POST /drivers/:driverId/accept/:rideId` – driver accepts assigned ride

All endpoints are documented through OpenAPI/Scalar with request and response schemas.

## Example Workflow

```bash
# 1. Create a ride
curl -X POST http://localhost:3000/rides \
  -H "Content-Type: application/json" \
  -d '{
        "userId": "user_123",
        "pickupLat": 6.54,
        "pickupLng": 3.35,
        "pickupAddress": "Lekki Phase 1",
        "destinationLat": 6.58,
        "destinationLng": 3.32,
        "destinationAddress": "Victoria Island"
      }'

# 2. Find nearby drivers
curl "http://localhost:3000/drivers/nearby?lat=6.54&lng=3.35&limit=5"

# 3. Driver accepts ride
curl -X POST http://localhost:3000/drivers/<driverId>/accept/<rideId>
```

If you set `API_KEY` in `.env`, include `x-api-key: <value>` in every request.

## Architecture Notes

- **NestJS + TypeORM** for modular services, DTO validation, and repository-based data access.
- **PostgreSQL/PostGIS** stores driver locations as `geography(Point,4326)` enabling `ST_Distance` queries.
- **Bull + Redis** powers the `ride-assignment` queue. Every ride creation enqueues a job that:
  1. Finds the closest available driver using `<->` distance ordering.
  2. Assigns the driver/ride inside a transaction, marking the driver `busy`.
  3. Retries once after 10s if no driver is available, then leaves the ride `pending`.
- **Global logging, validation, and exception handling** plus an optional API key guard for simple auth.
- **Scalar API Reference** replaces Swagger UI for a cleaner, themeable documentation experience.

## NPM Scripts

| Script | Description |
| --- | --- |
| `npm run start:dev` | Start NestJS with hot reload |
| `npm run build` | Compile to `dist` |
| `npm run migration:generate` | Create a new migration using `data-source.ts` |
| `npm run migration:run` | Run pending migrations |
| `npm run db:drop` | Drop schema via TypeORM CLI |
| `npm run db:reset` | Drop + migrate + seed |
| `npm run seed` | Populate demo drivers around Lagos |

## Testing

Use the provided cURL snippets or any REST client. For integration testing, spin up Docker services, seed the database, and exercise the queue-driven assignment flow by creating rides and observing driver state transitions via the endpoints.



<!-- Backed up to GitHub: 2026-11-15 17:59:57 UTC -->
