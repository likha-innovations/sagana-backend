# Project Memory: sagana-backend

Backend API for Sagana platform built with NestJS 11, Prisma 7, PostgreSQL, Clerk authentication, MQTT broker integration, and Socket.IO telemetry gateway.

## Commands

- `pnpm start:dev` — Dev server with hot reload (uses `.env.dev`)
- `pnpm start` — Standard start
- `pnpm build` — Generate Prisma client & compile NestJS (`prisma generate && nest build`)
- `pnpm test` — Run all Jest unit tests
- `pnpm test <name>` — Run specific test suite (e.g. `pnpm test users`, `pnpm test telemetry`)
- `pnpm test:watch` — Test watcher mode
- `pnpm test:cov` — Test coverage report
- `pnpm test:e2e` — End-to-end test suite
- `pnpm lint` — ESLint autofix
- `pnpm format` — Prettier formatting across `src/` and `test/`
- `pnpm docs:dev` — VitePress documentation dev server
- `npx prisma generate` — Regenerate `@prisma/client` after schema edits

## Architecture & Conventions

- **Modular Monolith**:
  - `src/core/`: Shared guards (`ClerkAuthGuard`), pipes (`ZodValidationPipe`), interceptors, logger (`LoggerService`), exception filters, rate limiting (`ThrottlerModule`), and env validation (`zod/v4`).
  - `src/infrastructure/`:
    - Database module & Prisma client service (`PrismaService` with `@prisma/adapter-pg`).
    - MQTT module (`MqttService` managing broker connection, topic subscriptions, and publishing commands).
  - `src/modules/`: Feature modules (`users`, `webhooks`, `telemetry`).
- **Authentication & Security**:
  - Global `ClerkAuthGuard` enforced via `APP_GUARD`.
  - Use `@Public()` decorator to bypass auth (e.g., Clerk webhooks, health checks).
  - Use `@CurrentUserId()` decorator to extract Clerk user ID from authenticated requests.
  - Global rate limiting: `ThrottlerModule` (100 req / 60s window).
- **Validation & DTOs**:
  - Feature-colocated DTOs in `src/modules/<feature>/dto/`.
  - Built with `nestjs-zod` (`createZodDto`) and `'zod/v4'`.
  - Avoid global DTO junk drawers; keep endpoint contracts next to feature controllers.
- **Database & Domain Models**:
  - PostgreSQL managed through Prisma (`prisma/schema.prisma`).
  - Tables mapped to snake_case names (e.g., `@@map("users")`, `@@map("compost_batches")`).
  - Core domain models: `User`, `IntakeRecord`, `CompostBatch`, `CompostOutput`, `MlPrediction`, `CompostingPhase`, `SensorReading`, `Sensor`, `IotDevice`, `Alert`.
- **Telemetry & Real-Time Gateway**:
  - Socket.IO gateway initialized under `/telemetry` namespace (`TelemetryGateway`).
  - Bridges hardware MQTT messages (`sagana/ping`, `sagana/pong`) to frontend WebSocket clients via `mqtt:ping` and `mqtt:pong` events.
- **Global Behaviors**:
  - Swagger UI available at `/api/docs` (`cleanupOpenApiDoc` for Zod compatibility).
  - Global response formatting wrapped via `TransformResponseInterceptor` (`{ success: true, data: T, timestamp }`).
  - Global error handling via `GlobalExceptionFilter`.
- **Git & Commits**:
  - Conventional Commits enforced via Husky + Commitlint (`.husky/commit-msg` + `.commitlintrc.json`).

## Current Features & Endpoints

- **Health Check (`/health`)**: Public endpoint returning API status and uptime.
- **Users (`/me`)**:
  - `GET /me` — Returns authenticated user profile (auto-syncs from Clerk if not yet in database).
  - `PATCH /me` — Updates `fullName`, `contactNumber`, and `location` using `UpdateProfileDto`.
- **Webhooks (`/webhooks/clerk`)**:
  - `POST /webhooks/clerk` — Public endpoint verifying Svix signatures to handle Clerk events (`user.created`, `user.updated`, `user.deleted`) and sync with PostgreSQL.
- **Telemetry & IoT (`/telemetry`)**:
  - `POST /telemetry/devices/:deviceId/command` — Dispatches MQTT control command to `sagana/devices/:deviceId/commands`.
  - Socket.IO `/telemetry` Namespace — Handles bidirectional client `ping`/`pong` and broadcasts live hardware events (`mqtt:ping`, `mqtt:pong`).

## Decisions & Dead-ends

- **Manual DTOs over `prisma-zod-generator`**: `prisma-zod-generator` was removed to keep the public HTTP API schema decoupled from internal database models and avoid redundant build generation.
- **Zod v4**: Project imports from `'zod/v4'` for strict schema validation.
- **MQTT to WebSocket Bridge Pattern**: Backend mediates between hardware MQTT brokers and client applications over namespaced Socket.IO connections, avoiding exposing raw MQTT broker credentials directly to mobile/web clients.
