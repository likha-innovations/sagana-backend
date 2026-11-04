# Batches and readings

All routes require authentication and only return machines in the user's barangay that have not been removed. Batch and machine identifiers outside that scope return 404.

1. `GET /batches` lists batches; `GET /batches/:id` returns one batch. Responses include feedstocks, phases, machine name, and optional compost output. A completion date makes the response status `completed` even if the stored status is `active`.
2. `POST /batches` accepts `{ machineId, feedstocks: [{ id, weight }] }`. Feedstocks must be active, unique, and have positive weights. A machine may have only one active batch.
3. `POST /batches/:id/finish` accepts `{ outputWeight? }`. The measured output weight is optional and must be nonnegative. Completion without a weight does not create an output record.
4. `GET /machines/:id/readings` and `GET /batches/:id/readings` accept optional ISO `startDate` and `endDate`, plus `offset` and `limit` (1–2000). They return sensor metadata, readings from `sensor_readings`, and `hasMore`. Batch readings are explicitly linked to that batch.

The reading representation exposes temperature, moisture, oxygen, and carbon dioxide where present. Telemetry logs are not included in sensor history.
