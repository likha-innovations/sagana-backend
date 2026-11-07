# Logging & Environment Configuration

---

## 🪵 Custom File & Console Logger

Sagana Backend implements a custom [`LoggerService`](../../src/core/logger/logger.service.ts) extending NestJS `ConsoleLogger`.

### Log Sinks
Logs are output both to stdout (terminal) and asynchronously appended to dedicated log files inside the `logs/` directory:

| Log File | Log Levels Written | Purpose |
| :--- | :--- | :--- |
| **`logs/bootstrap.log`** | `bootstrap` | Server startup, module resolution, and initialization stages. |
| **`logs/app.log`** | `log`, `warn`, `debug`, `verbose` | General application lifecycle and request handling events. |
| **`logs/error.log`** | `error` | Exceptions, failed validations, and unhandled errors. |

### Timestamp & Timezone Formatting
Log entries use **Tab-Separated Values (TSV)** formatted in the `Asia/Manila` timezone:
```tsv
8/17/26, 7:25:30 PM	UsersService	Fetching profile for user user_2xABC123
```

---

## 🛡️ Strict Environment Validation (Zod)

To prevent runtime failures caused by missing environment variables, [`env.validation.ts`](../../src/core/config/env.validation.ts) strictly parses process configuration before the server starts listening:

```typescript
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().startsWith('sk_'),
  CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  PORT: z.coerce.number().default(3000),

  // MQTT Broker (HiveMQ)
  MQTT_HOST: z.string().default('localhost'),
  MQTT_PORT: z.coerce.number().default(8883),
  MQTT_PROTOCOL: z.enum(['mqtt', 'mqtts', 'ws', 'wss']).default('mqtts'),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_CLIENT_ID: z.string().default('sagana_backend'),
});
```

If any required variable is missing or malformed (such as an invalid Clerk key prefix), the process terminates immediately at startup with an informative, pretty-printed error message.
