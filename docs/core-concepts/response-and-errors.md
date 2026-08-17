# Response & Error Handling Contract

Sagana Backend ensures that **all HTTP responses**, whether successful or erroneous, conform to predictable, unified JSON contracts across the application.

---

## ✅ Standard Success Response

All successful responses are automatically intercepted and formatted by [`TransformResponseInterceptor`](../../src/core/interceptors/transform-response.interceptor.ts).

### Contract Interface
```typescript
export interface StandardResponse<T> {
  success: boolean;
  data: T;
  timestamp: string; // ISO-8601 string
}
```

### Example Success JSON
```json
{
  "success": true,
  "data": {
    "id": "user_2xABC123456",
    "fullName": "Juan Dela Cruz",
    "email": "juan@example.com",
    "contactNumber": "+639123456789",
    "location": "Quezon City, Philippines",
    "createdAt": "2026-08-17T11:00:00.000Z",
    "updatedAt": "2026-08-17T11:05:00.000Z"
  },
  "timestamp": "2026-08-17T11:05:30.123Z"
}
```

---

## ❌ Standard Error Response

All unhandled exceptions and HTTP errors are intercepted by [`GlobalExceptionFilter`](../../src/core/exceptions/global-exception.filter.ts).

### Contract Interface
```json
{
  "success": false,
  "statusCode": 404,
  "message": "User profile not found",
  "timestamp": "2026-08-17T11:05:30.123Z"
}
```

---

## 🗄️ Database Error Code Mapping (Prisma)

The global filter translates raw Prisma exceptions into clean HTTP status codes and friendly error messages:

| Prisma Error Code | Description | Translated HTTP Status | Response Message |
| :--- | :--- | :--- | :--- |
| **`P2002`** | Unique constraint violation (e.g. duplicate email) | **`409 Conflict`** | `"A record with this value already exists"` |
| **`P2025`** | Record required for operation not found | **`404 Not Found`** | `"Record not found"` |
| *Other Prisma Errors* | Connection or query failure | **`400 Bad Request`** | `"Database request error"` |
| *Uncaught Exceptions* | Unhandled runtime errors | **`500 Internal Server Error`** | `"Internal server error"` |
