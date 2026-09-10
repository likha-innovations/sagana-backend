# IoT Telemetry & MQTT Rules (iot-telemetry-guard)

## 1. HiveMQ MQTT Connection Lifecycle
- **Connection Management**: Managed exclusively by `MqttService` (`src/infrastructure/mqtt/mqtt.service.ts`).
- **TLS Protocol**: Always connects over secure TLS (`mqtts://...:8883`) using credentials from ConfigService.
- **Resilience**: Auto-reconnect with 5-second retry interval. Broker connection drops must never crash the main NestJS process.

## 2. Topic Standardization
- **Inbound Stream (Uplink)**: Standard topic `sagana/stream` for live hardware sensor telemetry.
- **Outbound Commands (Downlink)**: Standard topic `sagana/commands` for hardware control commands.
- **Device-Specific Commands**: `sagana/devices/:deviceId/commands` for targeted device dispatches.

## 3. Real-Time WebSocket Gateway
- **Isolated Namespace**: Socket.IO gateway must remain under namespace `/telemetry`.
- **CORS**: WebSocket server enables CORS (`origin: '*'`).
- **Bridge Pattern**:
  - Inbound MQTT on `sagana/stream` ➔ emitted to WebSocket clients as event `'telemetry'`.
  - Inbound WebSocket on `'command'` ➔ published to HiveMQ as topic `sagana/commands`.

## 4. Defensive Payload Handling
- Always wrap MQTT message parsing in `try/catch`.
- Malformed JSON from hardware devices must be logged with `this.logger.error` and dropped gracefully without crashing handlers.
