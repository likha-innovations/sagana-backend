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
        "name": "Barangay San Antonio",
        "status": "active",
        "createdAt": "2026-08-01T00:00:00.000Z"
      },
      {
        "id": "cm1bg02",
        "name": "Barangay Holy Spirit",
        "status": "active",
        "createdAt": "2026-08-01T00:00:00.000Z"
      }
    ],
    "timestamp": "2026-11-03T01:20:00.000Z"
  }
  ```

---

## 🛡️ Multi-Tenant Scoping Rules

1. **User Association**: Every registered operator is assigned to exactly one `barangayId`.
2. **Machine Scoping**: Composting hardware units belong to a specific `barangayId`. Queries on `/machines` filter automatically to the authenticated user's barangay.
3. **Cross-Barangay Rejection**: Attempting to register a machine whose MAC address is already tied to another barangay produces a `409 Conflict`.

