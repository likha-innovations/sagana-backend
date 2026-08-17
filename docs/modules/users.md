# Users & Profile Management

The **Users Module** manages user identity data within the local PostgreSQL database after authentication has been verified by Clerk.

---

## 📍 Endpoints Overview

| Method | Endpoint | Protected | Description |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/me` | 🔒 Yes | Retrieves the database profile for the currently logged-in user. |
| **`PATCH`** | `/me` | 🔒 Yes | Partially updates profile fields (`fullName`, `contactNumber`, `location`). |

::: info 🛡️ Protected Routes Information
* **Global Guard**: Protected endpoints require authentication enforced globally by [`ClerkAuthGuard`](../../src/core/guards/clerk-auth.guard.ts).
* **Required Header**: Clients must supply a valid Clerk session token via the Authorization header:
  ```http
  Authorization: Bearer <clerk_session_jwt>
  ```
* **Request Context**: Once verified, the decoded Clerk user ID (`sub`) is automatically attached to `request.user.id` for downstream services.
* **Unauthorized Access**: Requests with missing, expired, or malformed tokens will immediately receive a `401 Unauthorized` response.
* **Public Endpoints**: Only endpoints explicitly decorated with `@Public()` (such as webhooks or public health checks) bypass authentication.
:::

---

## 🔍 Detailed Endpoints

### 1. `GET /me`
Retrieves user information associated with the authenticated Clerk User ID.

* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Success Response (200 OK):**
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
* **Error Response (404 Not Found):**
  Returned if the user exists in Clerk but has not yet synced to the PostgreSQL database via webhooks.

---

### 2. `PATCH /me`
Updates user profile fields with Zod validation.

* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Request Body Schema (`UpdateProfileDto`):**
  ```typescript
  const updateProfileSchema = z.object({
    fullName: z.string().min(2).optional(),
    contactNumber: z.string().min(5).optional(),
    location: z.string().min(2).optional(),
  });
  ```
* **Sample Request Body:**
  ```json
  {
    "fullName": "Juan Dela Cruz",
    "contactNumber": "+639991112233",
    "location": "Manila, Philippines"
  }
  ```
* **Success Response (200 OK):** Returns the updated user record inside the standard success envelope.
