# Changelog

All notable changes to the SAGANA Backend API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Compost batch creation and sensor reading endpoints for active composting cycles.
- Database seed script enhancements supporting configurable connection environments.

---

## [0.3.0] - 2026-11-03

### Changed
- **BREAKING**: Unified machine mutation request DTOs from `snake_case` to standard `camelCase`:
  - `RegisterMachineDto` now expects `macAddress` and `wifiSsid` (previously `mac_address` and `wifi_ssid`).
  - `UpdateMachineDto` now expects `name` and `wifiSsid` (previously `wifi_ssid`).
- Aligned machine soft-delete status to assign `inactive` instead of offline.

### Fixed
- Prevented silent drop of unknown profile update properties in user controller validation.

---

## [0.2.0] - 2026-10-25

### Added
- **EMQX MQTT Broker Integration**: Ingest real-time sensor streams from topic `sagana/devices/+/telemetry` and status transitions from `sagana/devices/+/status`.
- **Socket.IO Telemetry Gateway**: Real-time event broadcasting to mobile clients (`status`, `machine_added`, `machine_updated`, `machine_removed`, `telemetry`).
- Bidirectional MQTT command dispatch (`sagana/devices/<mac>/commands`) for remote machine renaming and operational actions.
- Machine management endpoints: update name/Wi-Fi (`PATCH /machines/:id`) and soft-delete (`DELETE /machines/:id`).
- Machine re-provisioning flow allowing previously registered devices to reconnect cleanly after NVS wipe.
- Feedstocks catalog endpoint (`GET /feedstocks`) returning active organic waste materials.

### Fixed
- Fixed Prisma JSON casting for dynamic sensor telemetry payloads in `telemetry_logs`.
- Initialized new machines to `offline` until first hardware MQTT ping is received.

---

## [0.1.0] - 2026-10-12

### Added
- **Database Architecture (ERD v2)**: Prisma 7 ORM with Neon PostgreSQL native adapter covering `barangays`, `users`, `machines`, `compost_batches`, `feedstocks`, `sensors`, and `telemetry_logs`.
- **Authentication & User Management**:
  - Global `ClerkAuthGuard` validating Bearer JWTs across protected endpoints.
  - Just-In-Time (JIT) Clerk user synchronization to PostgreSQL on initial login.
  - Svix webhook ingestion endpoint (`POST /webhooks/clerk`) for user lifecycle synchronization.
- **Barangay Scoping**: `GET /barangays` public directory endpoint and barangay-scoped access controls.
- **Developer Tooling**: Swagger UI documentation (`/api/docs`), Compodoc schemas, structured `LoggerService`, and global exception filters with standardized response envelopes.

