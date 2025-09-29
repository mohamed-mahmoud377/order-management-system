# Order Management System

A simplified e-commerce order management API built with NestJS, Prisma, and PostgreSQL.

## Prerequisites
- Node.js 18+ and npm
- PostgreSQL 13+ (local install) OR Docker Desktop (to run Postgres via container)
- For running tests: Docker Desktop (used by Testcontainers to spin up ephemeral Postgres)

## Environment Variables
Create a `.env` file in the project root with the following variables:

```
# Database connection string (PostgreSQL)
# Format: postgresql://USER:PASSWORD@HOST:PORT/DBNAME?schema=public
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/oms?schema=public

# JWT secret used to sign access tokens
JWT_SECRET=changeme-in-dev

# Optional: port the Nest app listens on (defaults to 3000)
PORT=3000
```

Notes:
- DATABASE_URL is required by Prisma. Update it to match your environment.
- JWT_SECRET must be set in any non-local environment. In dev you can use any random string.

## Setup and Installation

1) Install dependencies
- npm install

2) Set up the database
- Option A — Local Postgres you already have: ensure your DATABASE_URL points to it.
- Option B — Run Postgres with Docker:
  - docker run --name oms-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=oms -p 5432:5432 -d postgres:14
  - Then ensure DATABASE_URL in .env matches the container settings above.

3) Generate Prisma Client and run migrations
- npx prisma generate
- npm run prisma:migrate

4) (Optional) Seed sample data
- npm run seed

5) Start the application
- npm run start:dev
- The API will be available at: http://localhost:3000
- Swagger UI is available at: http://localhost:3000/api/docs

## Running Migrations in CI/Prod
- Use: npm run prisma:deploy
- This applies any pending migrations without creating new ones.

## Running Tests
- Requirements: Docker Desktop running (tests use Testcontainers to launch a temporary PostgreSQL)
- Commands:
  - npm test — runs unit/integration tests against an ephemeral DB
  - npm run test:watch — watch mode
  - npm run test:cov — coverage

## Useful Scripts
- build: nest build
- start: nest start
- start:dev: nest start --watch
- prisma:generate: prisma generate
- prisma:migrate: prisma migrate dev
- prisma:deploy: prisma migrate deploy
- prisma:studio: prisma studio
- seed: ts-node prisma/seed.ts
- test: jest --runInBand

## Features
- Users: registration, login (JWT), profile update
- Products: CRUD (admin), search/filter
- Orders: create, history, details, cancel (pending only), status updates (admin)
- Business logic: inventory validation, total calculation with tax, stock adjustments
- Recommendation endpoint: /products/recommendations/:userId
- Security: JWT auth, roles guard, rate limiting, security headers (Helmet)
- Performance: In-memory caching for GET endpoints
- API Docs via Swagger at /api/docs

## Troubleshooting
- PrismaClientInitializationError: Environment variable not found: DATABASE_URL
  - Ensure .env exists and DATABASE_URL is set correctly.
- Cannot connect to database
  - If using Docker, check: docker ps and container logs via: docker logs oms-postgres

## Security and Performance Notes
- Helmet is enabled in main.ts to add standard security headers.
- X-Powered-By is disabled to avoid leaking framework details.
- CORS is explicitly configured; tighten allowed origins via environment if deploying to production.