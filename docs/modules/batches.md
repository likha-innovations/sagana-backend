# Batches & Sensor History

The **Batches Module** manages composting batch lifecycles, feedstock composition ratios, output yields, and historical sensor time-series telemetry across barangay-scoped machines.

---

## 📍 Endpoints Overview

All routes require Bearer token authentication and operate strictly on non-removed machines within the authenticated operator's assigned barangay. Batch or machine identifiers outside that scope return `404 Not Found`.

| Method | Endpoint | Protected | Description |
| :--- | :--- | :---: | :--- |
| **`GET`** | `/batches` | 🔒 Yes | Lists all composting batches in the user's barangay. |
| **`GET`** | `/batches/:id` | 🔒 Yes | Retrieves details of a specific batch including feedstocks and output. |
| **`POST`** | `/batches` | 🔒 Yes | Starts a new batch with input feedstock components. |
| **`POST`** | `/batches/:id/finish` | 🔒 Yes | Marks a batch as completed with optional measured output weight. |
| **`GET`** | `/machines/:id/readings` | 🔒 Yes | Queries historical sensor readings for a machine with pagination. |
| **`GET`** | `/batches/:id/readings` | 🔒 Yes | Queries historical sensor readings linked to a specific batch. |

---

## 🔍 Detailed Endpoints

### 1. `GET /batches`
Lists all composting batches for machines belonging to the user's assigned barangay. Responses include associated feedstocks, composting phases, machine name, and optional compost output. If a batch has a `completionDate`, the computed status is reported as `completed` regardless of the raw database column value.

* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "cm1batch01",
        "machineId": "cm1machine01",
        "userId": "user_2xABC123",
        "batchCode": "BATCH-123e4567-e89b-42d3-a456-426614174000",
        "status": "completed",
        "startDate": "2026-10-01T00:00:00.000Z",
        "completionDate": "2026-10-10T00:00:00.000Z",
        "totalWeight": 25.5,
        "machineName": "Composter Alpha",
        "finalWeight": 16.2,
        "feedstocks": [
          {
            "id": "item123",
            "feedstockId": "feedstock123",
            "name": "Dry Leaves",
            "category": "brown",
            "weightKg": 15.5
          },
          {
            "id": "item124",
            "feedstockId": "feedstock124",
            "name": "Food Scraps",
            "category": "green",
            "weightKg": 10.0
          }
        ],
        "compostingPhases": [],
        "finalWeight": 16.2
      }
    ],
    "timestamp": "2026-10-10T00:00:00.000Z"
  }
  ```

---

### 2. `GET /batches/:id`
Retrieves single batch details by ID.

* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Path Parameters:**
  * `id`: Batch cuid
* **Success Response (200 OK):** Returns single batch object in the standard success envelope.
* **Error Response (404 Not Found):** Returned if the batch does not exist, belongs to another barangay, or its machine was removed.

---

### 3. `POST /batches`
Starts a new composting batch. The machine must belong to the user's barangay and cannot have another currently active batch. Feedstock IDs must be active, unique in the payload, and have positive finite weights.

* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Request Body Schema:**
  ```typescript
  {
    machineId: string;
    feedstocks: Array<{
      id: string;      // Active Feedstock ID
      weight: number;  // Positive finite number in kilograms
    }>;
  }
  ```
* **Sample Request Body:**
  ```json
  {
    "machineId": "cm1machine01",
    "feedstocks": [
      { "id": "feedstock_leaves", "weight": 15.0 },
      { "id": "feedstock_scraps", "weight": 10.0 }
    ]
  }
  ```
* **Success Response (201 Created):** Returns the newly created batch in `active` status.
* **Error Responses:**
  * `400 Bad Request`: Inactive, missing, duplicate feedstock items, or invalid non-positive weights.
  * `404 Not Found`: Machine not found or inaccessible in the user's barangay.
  * `409 Conflict`: The target machine already has an active ongoing batch.

---

### 4. `POST /batches/:id/finish`
Concludes an active batch. Setting `finalWeight` is optional; if provided, it is stored directly on the batch. (`outputWeight` is also accepted as a backwards-compatible alias).

* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Path Parameters:**
  * `id`: Batch cuid
* **Request Body Schema:**
  ```typescript
  {
    finalWeight?: number;  // Optional finite number >= 0 (kg)
    outputWeight?: number; // Backwards-compatible alias for finalWeight
  }
  ```
* **Sample Request Body:**
  ```json
  {
    "finalWeight": 14.5
  }
  ```
* **Success Response (201 Created):** Returns completed batch entity with `finalWeight`.
* **Error Responses:**
  * `400 Bad Request`: `finalWeight` is negative or non-finite.
  * `404 Not Found`: Batch not found or belongs to another barangay.
  * `409 Conflict`: Batch is not in `active` status (already completed).

---

### 5. `GET /machines/:id/readings`
Returns historical sensor readings recorded for a specific machine, ordered newest first. Exposes temperature, moisture, oxygen, and carbon dioxide measurements.

* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Path Parameters:**
  * `id`: Machine cuid
* **Query Parameters:**
  * `startDate` *(optional)*: ISO 8601 UTC timestamp filter start (inclusive).
  * `endDate` *(optional)*: ISO 8601 UTC timestamp filter end (inclusive).
  * `offset` *(optional)*: Pagination offset, 0–100,000 (default: `0`).
  * `limit` *(optional)*: Page size, 1–2,000 (default: `200`).
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "sensors": [
        {
          "id": "sensor123",
          "machineId": "cm1machine01",
          "sensorType": "temperature",
          "location": "core",
          "unit": "°C",
          "status": "active"
        }
      ],
      "readings": [
        {
          "id": "reading123",
          "machineId": "cm1machine01",
          "batchId": "cm1batch01",
          "recordedAt": "2026-10-05T08:30:00.000Z",
          "temperature": 45.2,
          "moisture": 60.5,
          "oxygen": null,
          "co2": null
        }
      ],
      "hasMore": false
    },
    "timestamp": "2026-10-10T00:00:00.000Z"
  }
  ```

---

### 6. `GET /batches/:id/readings`
Queries historical sensor readings explicitly linked to the specified batch. Accepts the same time range and pagination query parameters as `/machines/:id/readings`.
