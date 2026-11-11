# Machines & Hardware Management

The **Machines Module** manages AIVSP composting hardware units, device registration, network configuration, and barangay-scoped access control.

---

## 📍 Endpoints Overview

All machine endpoints require authentication and are scoped to the authenticated operator's assigned barangay.

Machine request and response properties use camelCase. Registration requires `macAddress` and `wifiSsid`; older clients sending `mac_address` and `wifi_ssid` must update. Database column mappings and real-time event payloads are unchanged.

| Method | Endpoint | Protected | Description |
| :--- | :--- | :---: | :--- |
| **`GET`** | `/machines` | 🔒 Yes | Lists all non-removed machines in the user's barangay. |
| **`GET`** | `/machines/:id` | 🔒 Yes | Retrieves details of a specific machine by ID. |
| **`POST`** | `/machines/register` | 🔒 Yes | Registers a new machine or re-provisions an existing device. |
| **`PATCH`** | `/machines/:id` | 🔒 Yes | Updates machine display name or Wi-Fi SSID. |
| **`DELETE`** | `/machines/:id` | 🔒 Yes | Soft-removes a machine (`removedAt` timestamp set). |

---

## 🔍 Detailed Endpoints

### 1. `GET /machines`
Retrieves all machines that belong to the user's `barangayId` and have `removedAt: null`, ordered oldest-first.

* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "cm1abc...",
        "barangayId": "cm1xyz...",
        "macAddress": "20:50:0D:E6:C0:3C",
        "name": "Composter Alpha",
        "status": "active",
        "wifiSsid": "Likha-WiFi",
        "lastSeen": "2026-11-03T01:15:00.000Z",
        "createdAt": "2026-10-15T08:00:00.000Z",
        "removedAt": null
      }
    ],
    "timestamp": "2026-11-03T01:20:00.000Z"
  }
  ```

---

### 2. `GET /machines/:id`
Retrieves a specific non-removed machine by ID within the operator's barangay.

* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Success Response (200 OK):** Machine entity JSON in the standard data envelope.
* **Error Response (404 Not Found):** Returned if the machine does not exist, belongs to another barangay, or was soft-removed.

---

### 3. `POST /machines/register`
Registers an AIVSP machine using its physical hardware MAC address and initial Wi-Fi SSID.

* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Request Body Schema (`RegisterMachineDto`):**
  ```typescript
  {
    macAddress: string; // Valid MAC format (XX:XX:XX:XX:XX:XX)
    name: string;        // 1-50 characters
    wifiSsid: string;   // Required Wi-Fi SSID
  }
  ```
* **Sample Request Body:**
  ```json
  {
    "macAddress": "20:50:0D:E6:C0:3C",
    "name": "Composter Unit 1",
    "wifiSsid": "Community-Mesh"
  }
  ```
* **Success Response (201 Created):** Returns the created machine entity.
* **Re-provisioning Behavior:** If the MAC address already exists in the *same* barangay, the record is updated, `removedAt` is reset to `null`, and `status` is restored to `active`.
* **Conflict (409 Conflict):** Returned if the machine is already registered to a *different* barangay.
* **Real-time Broadcast:** Emits `machine_added` on the `/telemetry` Socket.IO namespace to synchronize connected mobile clients instantly.

---

### 4. `PATCH /machines/:id`
Updates machine name or Wi-Fi SSID.

* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Request Body Schema (`UpdateMachineDto`):**
  ```typescript
  {
    name?: string;      // 1-50 characters
    wifiSsid?: string; // Optional
  }
  ```
* **Downlink Hardware Sync:** When `name` is changed, backend immediately publishes an MQTT command to `sagana/devices/<macAddress>/commands`:
  ```json
  {
    "action": "SET_NAME",
    "name": "Composter Unit 1"
  }
  ```
* **Real-time Broadcast:** Emits `machine_updated` on `/telemetry` with `{ machineId, name, barangayId }`.

---

### 5. `DELETE /machines/:id`
Performs a soft-delete by setting `removedAt = new Date()` and `status = 'inactive'`.

* **Headers:** `Authorization: Bearer <clerk_session_token>`
* **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "success": true,
      "message": "Machine removed successfully"
    },
    "timestamp": "2026-11-03T01:20:00.000Z"
  }
  ```
* **Real-time Broadcast:** Emits `machine_removed` on `/telemetry` with `{ machineId, barangayId }`.

---

## ⚡ Real-Time Socket.IO Synchronization

The `MachinesService` integrates with `TelemetryGateway` to broadcast instant updates to mobile applications:

| Event | Emitted When | Payload Shape |
| :--- | :--- | :--- |
| **`machine_added`** | Machine registered or re-provisioned | `{ machineId, name, macAddress, barangayId, wifiSsid, status, createdAt }` |
| **`machine_updated`** | Machine renamed or Wi-Fi updated | `{ machineId, name, barangayId }` |
| **`machine_removed`** | Machine soft-deleted | `{ machineId, barangayId }` |

---

## 🛠️ Maintenance: Hard-Delete Script

For test/development cleanup or administrative device resets, a maintenance script is available:

```bash
# Delete pre-configured target MACs
pnpm run delete:machines

# Or pass specific MAC address(es) via CLI arguments
pnpm run delete:machines 20:50:0D:E6:C0:3C 38:3E:51:CB:05:74
```

The script runs a single PostgreSQL transaction that cascadingly deletes all related records:
1. `sensor_readings`
2. `sensors`
3. `batch_feedstocks`
4. `composting_phases`
5. `compost_batches`
6. `telemetry_logs`
7. `machines`

