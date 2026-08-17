# Authentication & Security Lifecycle

Sagana Backend delegates user identity, authentication, session security, and credential management to **Clerk** via `@clerk/backend`.

---

## 🔒 Global Protection Model

By default, **every route in the backend is guarded and private**. 

The [`ClerkAuthGuard`](../../src/core/guards/clerk-auth.guard.ts) is registered as a global guard in [`AppModule`](../../src/app.module.ts):

```typescript
// app.module.ts
providers: [
  {
    provide: APP_GUARD,
    useClass: ClerkAuthGuard,
  },
]
```

---

## 🧭 Authentication Lifecycle Flow

```mermaid
flowchart TD
    Client["1. 📱 Client sends Request<br/><code>Authorization: Bearer &lt;jwt&gt;</code>"] --> Guard["2. ClerkAuthGuard Intercepts"]
    Guard --> CheckPublic{"Has @Public() metadata?"}
    
    CheckPublic -->|YES| Allow["✅ Allow Request (e.g. /health)"]
    CheckPublic -->|NO| CheckToken{"Bearer Token Present?"}
    
    CheckToken -->|NO| ErrMissing["❌ 401 Unauthorized (Missing Token)"]
    CheckToken -->|YES| VerifyJWT["Verify JWT via Clerk SDK & CLERK_SECRET_KEY"]
    
    VerifyJWT --> CheckValid{"Is Token Valid?"}
    CheckValid -->|Invalid / Expired| ErrInvalid["❌ 401 Unauthorized (Invalid Token)"]
    CheckValid -->|Valid| Attach["Attach Claims to Request<br/><code>req.user = { id: payload.sub }</code>"]
    
    Attach --> Handler["3. Controller Handler Executes<br/><code>@CurrentUserId() extracts req.user.id</code>"]
```

---

## 🏷️ Custom Decorators

### 1. `@Public()`
Bypasses the global `ClerkAuthGuard`. Use this for health checks, public info, and webhook endpoints.

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/core/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  checkHealth() {
    return { status: 'healthy' };
  }
}
```

---

### 2. `@CurrentUserId()`
Injects the authenticated user's Clerk ID (`user_2bX...`) directly into the controller handler.

```typescript
import { Controller, Get } from '@nestjs/common';
import { CurrentUserId } from 'src/core/decorators/current-user.decorator';

@Controller('me')
export class UsersController {
  @Get()
  getProfile(@CurrentUserId() userId: string) {
    return this.usersService.getProfile(userId);
  }
}
```
