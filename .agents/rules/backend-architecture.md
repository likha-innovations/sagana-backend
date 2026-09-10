# Backend Architecture Rules (backend-architect)

## 1. Modular Monolith Directory Structure
All backend code inside `sagana-backend/src/` must adhere strictly to the role-based layered architecture:

```text
src/
├── core/                 # ⚙️ GLOBAL CROSS-CUTTING CONCERNS
│   ├── config/           # Environment validation (env.validation.ts)
│   ├── decorators/       # Custom decorators (@Public(), @CurrentUserId())
│   ├── exceptions/       # Global exception filter (global-exception.filter.ts)
│   ├── guards/           # Global authentication guards (clerk-auth.guard.ts)
│   ├── interceptors/     # Response transformation (transform-response.interceptor.ts)
│   ├── logger/           # Structured LoggerService (logger.service.ts)
│   └── pipes/            # Global validation pipes (ZodValidationPipe)
│
├── infrastructure/       # 🔌 EXTERNAL DRIVERS & CONNECTIONS
│   ├── database/         # PrismaService with @prisma/adapter-pg
│   └── mqtt/             # MqttService managing HiveMQ broker connection
│
├── modules/              # 📦 FEATURE DOMAINS (MODULAR)
│   ├── users/            # UsersController, UsersService, users.module.ts
│   │   └── dto/          # Colocated DTOs (update-profile.dto.ts)
│   ├── telemetry/        # TelemetryController, TelemetryGateway, telemetry.service.ts
│   │   └── dto/          # Colocated DTOs (publish-command.dto.ts)
│   └── webhooks/         # WebhooksController, webhooks.module.ts
│
├── app.controller.ts     # Health check endpoint (/health)
├── app.module.ts         # Root NestJS module importing Core, Infra, and Modules
└── main.ts               # Application bootstrap (CORS, prefix, Swagger, 0.0.0.0 binding)
```

## 2. Feature Colocation & DTO Hygiene
- **Feature-Colocated DTOs**: DTOs must live inside `src/modules/<feature>/dto/` next to their respective controllers. Never create global "junk drawer" DTO folders.
- **Adjacent Test Files**: Unit tests (`*.spec.ts`) must live in the exact same folder as the controller or service being tested.

## 3. Unidirectional Dependency Rule
- **Allowed Direction**: `modules/` may import from `infrastructure/` and `core/`.
- **Strictly Banned**: `infrastructure/` and `core/` must never import from `modules/`. Avoid circular dependencies.

## 4. Host & Cloud Deployment Standards
- **Cloud/Render Binding**: Always bind the HTTP server to `0.0.0.0` using `process.env.PORT ?? 3000` in `main.ts`.
- **Raw Request Body Preservation**: Always keep `rawBody: true` in `NestFactory.create` to ensure Svix signature verification works for Clerk webhooks.
- **Graceful Shutdown**: Always handle lifecycle hooks (`OnModuleInit`, `OnModuleDestroy`) in infrastructure services (`PrismaService`, `MqttService`).
