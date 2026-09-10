# Auth & Security Rules (auth-guardian)

## 1. 🛡️ Strict Privacy & Secret Isolation
- **NEVER Inspect `.env` Directly**: Agents are forbidden from viewing or printing `.env` files.
- Inspect `.env.example` and `src/core/config/env.validation.ts` to understand required keys.
- Never output real keys (`sk_...`, `pk_...`, database URLs with passwords) in conversations or artifacts.

## 2. Default-Closed Authentication
- `ClerkAuthGuard` is registered globally as `APP_GUARD` in `AppModule`.
- Every endpoint is protected by default.
- To make an endpoint publicly accessible (e.g. `/health`, `/webhooks/clerk`), apply the `@Public()` decorator explicitly.

## 3. Current User Extraction
- Always extract the authenticated user ID via `@CurrentUserId() userId: string`.
- Never access raw `request.user` or untyped request objects in controller handlers.

## 4. Dual-Sync User Guarantee
- **Primary (Real-Time Webhooks)**: Handle Clerk events (`user.created`, `user.updated`, `user.deleted`) in `WebhooksController` with Svix signature verification (`CLERK_WEBHOOK_SECRET`).
- **Fallback (Just-in-Time Auto-Sync)**: In `UsersService.getProfile()`, if the user record does not exist in PostgreSQL, fetch user data from Clerk API via `createClerkClient({ secretKey })` and automatically upsert into Neon PostgreSQL.

## 5. Rate Limiting & Throttling
- Global rate limiting is enforced via `ThrottlerModule` (100 requests per 60-second window).
- Sensitive or resource-heavy endpoints must use `@Throttle()` where appropriate.
