# Users & Profile Management

The **Users Module** manages user identity data within the local PostgreSQL database after authentication has been verified by Clerk.

---

## 📍 Endpoints Overview

| Method | Endpoint | Protected | Description |
| :--- | :--- | :--- | :--- |
| **`GET`** | `/me` | 🔒 Yes | Retrieves the database profile for the currently logged-in user. |
| **`PATCH`** | `/me` | 🔒 Yes | Partially updates profile fields (`firstName`, `lastName`, `birthday`, `barangayId`). |
| **`POST`** | `/me/barangay-code` | 🔒 Yes | Validates a barangay code and assigns the barangay to an unassigned account. |
| **`GET`** | `/operators` | 🔒 Admin | Retrieves operator accounts in the admin's barangay. |


::: info 🛡️ Protected Routes Information
* **Global Guard**: Protected endpoints require authentication enforced globally by [`ClerkAuthGuard`](../../src/core/guards/clerk-auth.guard.ts).
* **Required Header**: Clients must supply a valid Clerk session token via the Authorization header:
  ```http
  Authorization: Bearer <clerk_session_jwt>
  ```
* **Request Context**: Once verified, the decoded Clerk user ID (`sub`) is automatically attached to `request.user.id` for downstream services.
* **Unauthorized Access**: Requests with missing, expired, or malformed tokens will immediately receive a `401 Unauthorized` response.
* **Public Endpoints**: Only endpoints explicitly decorated with `@Public()` (such as public health checks) bypass authentication.
:::

---

## 🔍 Detailed Endpoints

### 1. `GET /me`
Retrieves user information associated with the authenticated Clerk User ID.

The returned `verificationStatus` is informational; it does not restrict access.
The migration marks existing users as `verified`; newly created users default to `unverified`. The separate user seed helper inserts only explicitly supplied users and skips existing records.

* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": "user_2xABC123456",
      "barangayId": "cm123abc...",
      "fullName": "Juan Dela Cruz",
      "birthday": "1995-05-15T00:00:00.000Z",
      "email": "juan@example.com",
      "role": "operator",
      "status": "active",
      "verificationStatus": "unverified",
      "createdAt": "2026-08-17T11:00:00.000Z",
      "barangay": {
        "id": "cm123abc...",
        "name": "Barangay San Antonio",
        "status": "active",
        "createdAt": "2026-08-01T00:00:00.000Z"
      }
    },
    "timestamp": "2026-08-17T11:05:30.123Z"
  }
  ```
* **Error Response (404 Not Found):**
  Returned if the profile cannot be retrieved from the database or synchronized from Clerk.

---

### 2. `PATCH /me`
Updates user profile fields with Zod validation. Supply at least one field; name parts are combined to form `fullName`.

* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Request Body Schema (`UpdateProfileDto`):**
  ```typescript
  const updateProfileSchema = z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    birthday: z.string().optional(),
    barangayId: z.string().optional(),
  });
  ```
* **Sample Request Body:**
  ```json
  {
    "firstName": "Juan",
    "lastName": "Dela Cruz",
    "birthday": "1995-05-15T00:00:00.000Z"
  }
  ```
* **Success Response (200 OK):** Returns the updated user record inside the standard success envelope.
* **Error Response (400 Bad Request):** Returned if names are shorter than 2 characters or validation fails.

---

### 3. `POST /me/barangay-code`
Validates an active barangay join code and associates the barangay with the authenticated user. Limited to 10 requests per minute via `ThrottlerGuard`.

* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Request Body Schema:**
  ```typescript
  {
    code: string; // 6-character alphanumeric string (case-insensitive)
  }
  ```
* **Sample Request Body:**
  ```json
  {
    "code": "ABC123"
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "id": "cm123abc...",
      "name": "Barangay San Antonio"
    },
    "timestamp": "2026-11-03T01:20:00.000Z"
  }
  ```
* **Conflict Behavior (409 Conflict):** If the user is already assigned to a *different* barangay, a `409 Conflict` is returned. Re-submitting the same barangay code succeeds idempotently.
* **Rate Limited (429 Too Many Requests):** Returned when exceeding 10 attempts per minute.

---

### 4. `GET /operators`
Retrieves operator accounts in the authenticated admin's assigned barangay. An admin role and barangay assignment are required.

* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "user_2xABC123456",
        "barangayId": "cm123...",
        "fullName": "Juan Dela Cruz",
        "birthday": "1995-05-15T00:00:00.000Z",
        "email": "juan@example.com",
        "role": "operator",
        "status": "active",
        "createdAt": "2026-08-17T11:00:00.000Z",
        "barangay": {
          "id": "cm123...",
          "name": "Barangay San Antonio"
        }
      }
    ],
    "timestamp": "2026-10-25T14:40:00.000Z"
  }
  ```

