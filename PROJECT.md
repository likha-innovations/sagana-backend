# Project Memory: sagana-backend

Backend API for Sagana platform built with NestJS, Prisma, PostgreSQL, and Clerk authentication.

## Commands

- `pnpm start:dev` — Dev server with hot reload (uses `.env.dev`)
- `pnpm start` — Standard start
- `pnpm build` — Generate Prisma client & compile NestJS (`prisma generate && nest build`)
- `pnpm test` — Run all Jest unit tests
- `pnpm test <name>` — Run specific test suite (e.g. `pnpm test users`)
- `pnpm test:watch` — Test watcher mode
- `pnpm test:cov` — Test coverage report
- `pnpm test:e2e` — End-to-end test suite
- `pnpm lint` — ESLint autofix
- `pnpm docs:dev` — VitePress documentation dev server
- `npx prisma generate` — Regenerate `@prisma/client` after schema edits

## Architecture & Conventions

- **Modular Monolith**:
  - `src/core/`: Shared guards (`ClerkAuthGuard`), pipes (`ZodValidationPipe`), interceptors, logger, exception filters, env validation (`zod/v4`).
  - `src/infrastructure/`: Database module & Prisma client service (`PrismaService`).
  - `src/modules/`: Feature modules (`users`, `webhooks`, etc.).
- **Authentication**:
  - Global `ClerkAuthGuard` enforced via `APP_GUARD`.
  - Use `@Public()` decorator to bypass auth (e.g., Clerk webhooks, health checks).
  - Use `@CurrentUserId()` decorator to extract Clerk user ID from authenticated requests.
- **Validation & DTOs**:
  - Feature-colocated DTOs in `src/modules/<feature>/dto/`.
  - Built with `nestjs-zod` (`createZodDto`) and `zod/v4`.
  - Avoid global DTO junk drawers; keep endpoint contracts next to feature controllers.
- **Database**:
  - PostgreSQL managed through Prisma (`prisma/schema.prisma`).
  - Models mapped to snake_case tables (e.g., `@@map("users")`).
- **Global Behaviors**:
  - Swagger UI available at `/api/docs` (`cleanupOpenApiDoc` for Zod compatibility).
  - Global response formatting wrapped via `TransformResponseInterceptor`.
  - Global error handling via `GlobalExceptionFilter`.
- **Git & Commits**:
  - Conventional Commits enforced via Husky + Commitlint (`.husky/commit-msg` + `.commitlintrc.json`).
  - Recommended VS Code extension: `vivaxy.vscode-conventional-commits`.

## Current Features & Endpoints

- **Health Check (`/health`)**: Public endpoint returning API status and uptime.
- **Users (`/me`)**:
  - `GET /me` — Returns authenticated user profile (auto-syncs from Clerk if not yet in database).
  - `PATCH /me` — Updates `fullName`, `contactNumber`, and `location` using `UpdateProfileDto`.
- **Webhooks (`/webhooks/clerk`)**:
  - `POST /webhooks/clerk` — Public endpoint verifying Svix signatures to handle Clerk events (`user.created`, `user.updated`, `user.deleted`) and sync with PostgreSQL.

## Decisions & Dead-ends

- **Manual DTOs over `prisma-zod-generator`**: `prisma-zod-generator` was removed to keep the public HTTP API schema decoupled from internal database models and avoid redundant build generation.
- **Zod v4**: Project imports from `'zod/v4'` for strict schema validation.
