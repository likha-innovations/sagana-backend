# Barangays Module

The **Barangays Module** manages local community administrative boundaries, enabling multi-tenant data isolation across users, composting machines, and batches.

---

## 📍 Endpoints Overview

| Method | Endpoint | Protected | Description |
| :--- | :--- | :---: | :--- |
| **`GET`** | `/barangays` | 🌐 Public | Lists all active barangays. |
| **`POST`** | `/barangays/validate-code` | 🌐 Public | Validates a code and returns the barangay ID and name. |
| **`GET`** | `/barangays/code` | 🔒 Admin | Returns the admin barangay's current code. |
| **`POST`** | `/barangays/code/rotate` | 🔒 Admin | Rotates the admin barangay's code. |

Run `pnpm run seed:barangay-codes` with `DATABASE_URL` set after applying the migration. It generates codes only for barangays without one. Existing codes are preserved; the script does not run the general machine-data seed.

---

## 🔍 Detailed Endpoints

### 1. `GET /barangays`
Returns all active barangay entries used during operator onboarding and profile completion.

* **Authorization:** Public (`@Public()`)
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "cm1bg01",
        "name": "Barangay Holy Spirit"
      },
      {
        "id": "cm1bg02",
        "name": "Barangay San Antonio"
      }
    ],
    "timestamp": "2026-11-03T01:20:00.000Z"
  }
  ```

---

### 2. `POST /barangays/validate-code`
Validates an active 6-character barangay join code and returns the matching barangay ID and name. Rate limited to 10 requests per minute via `ThrottlerGuard`.

* **Authorization:** Public (`@Public()`)
* **Request Body Schema:**
  ```typescript
  {
    code: string; // 6 alphanumeric characters; whitespace trimmed, case-insensitive
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
      "id": "cm1bg02",
      "name": "Barangay San Antonio"
    },
    "timestamp": "2026-11-03T01:20:00.000Z"
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: Code is missing, inactive, or malformed (`"Invalid barangay code"`).
  * `429 Too Many Requests`: Exceeded 10 requests per minute rate limit.

---

### 3. `GET /barangays/code`
Returns the current join code for the authenticated administrator's assigned barangay.

* **Authorization:** Admin (`@AdminOnly()`)
* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "code": "ABC123"
    },
    "timestamp": "2026-11-03T01:20:00.000Z"
  }
  ```
* **Error Responses:**
  * `401 Unauthorized`: Missing or invalid Clerk token.
  * `403 Forbidden`: User is not an admin or does not have an assigned barangay.

---

### 4. `POST /barangays/code/rotate`
Generates and assigns a new random 6-character join code for the administrator's barangay, replacing the old code immediately.

* **Authorization:** Admin (`@AdminOnly()`)
* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "code": "XYZ789"
    },
    "timestamp": "2026-11-03T01:20:00.000Z"
  }
  ```
* **Error Responses:**
  * `401 Unauthorized`: Missing or invalid Clerk token.
  * `403 Forbidden`: Admin role or barangay assignment missing.

---

## 🛡️ Multi-Tenant Scoping Rules

1. **User Association**: Every registered operator is assigned to exactly one `barangayId`.
2. **Machine Scoping**: Composting hardware units belong to a specific `barangayId`. Queries on `/machines` filter automatically to the authenticated user's barangay.
3. **Cross-Barangay Rejection**: Attempting to register a machine whose MAC address is already tied to another barangay produces a `409 Conflict`.

