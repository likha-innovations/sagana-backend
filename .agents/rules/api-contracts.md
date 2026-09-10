# API Contract & Cross-Stack Rules (api-contracts-guard)

## 1. Single Source of Truth
- **Backend Zod Schemas**: Schemas defined with `nestjs-zod` and `'zod/v4'` in `src/modules/<feature>/dto/` are the authoritative source of truth for all request payloads and response contracts.
- **Cross-Stack Symmetry**: Mobile TypeScript types in `sagana-mobile/src/types/` must mirror backend schemas 1:1.

## 2. Standardized Response Envelope
- All successful REST API responses must be wrapped via `TransformResponseInterceptor`:
  ```json
  {
    "success": true,
    "data": T,
    "timestamp": "ISO-8601"
  }
  ```
- Endpoints must return the raw entity or data `T` directly from their service methods; the interceptor handles wrapping.

## 3. Structured Error Handling
- All HTTP exceptions must be formatted via `GlobalExceptionFilter`:
  ```json
  {
    "success": false,
    "statusCode": 400,
    "message": "Descriptive error message",
    "timestamp": "ISO-8601"
  }
  ```
- Use built-in NestJS HTTP exceptions (`NotFoundException`, `BadRequestException`, `UnauthorizedException`) with clear human-readable messages.

## 4. API Prefix & Route Discipline
- **Respect Global Prefix**: Route paths in controllers must never hardcode prefixes (use `@Controller('me')`, never `@Controller('api/me')`).
- If `process.env.API_PREFIX` is set, `main.ts` will automatically apply the global prefix.
