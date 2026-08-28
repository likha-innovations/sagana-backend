import { Injectable, OnModuleInit } from '@nestjs/common';
import { LoggerService } from '../../core/logger/logger.service';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';
import { PublishCommandDto } from './dto/publish-command.dto';
import { TelemetryQueryDto } from './dto/telemetry-query.dto';

export interface TelemetryPayload {
  batchId?: string;
  sensorId: string;
  value: number;
  unit: string;
  timestamp?: string;
}

export interface DeviceStatusPayload {
  status: string;
  processingStage?: string;
}

@Injectable()
export class TelemetryService implements OnModuleInit {
  private readonly inMemoryReadings: Array<
    TelemetryPayload & { deviceId: string; timestamp: string }
  > = [];

  constructor(
    private readonly mqttService: MqttService,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit() {
    this.mqttService.onMessage((topic, payload) => {
      this.handleIncomingMqttMessage(topic, payload);
    });
  }

  handleIncomingMqttMessage(topic: string, payload: Buffer) {
    try {
      const topicParts = topic.split('/');
      // Topic pattern: sagana/devices/{deviceId}/{messageType}
      if (
        topicParts.length < 4 ||
        topicParts[0] !== 'sagana' ||
        topicParts[1] !== 'devices'
      ) {
        return;
      }

      const deviceId = topicParts[2];
      const messageType = topicParts[3]; // 'telemetry' | 'status'

      const rawString = payload.toString();
      if (!rawString) return;

      const parsedData = JSON.parse(rawString);

      if (messageType === 'telemetry') {
        this.processTelemetry(deviceId, parsedData);
      } else if (messageType === 'status') {
        this.processDeviceStatus(deviceId, parsedData);
      }
    } catch (err) {
      this.logger.error(
        `Failed to process MQTT message from topic ${topic}: ${err instanceof Error ? err.message : err}`,
        TelemetryService.name,
      );
    }
  }

  private processTelemetry(
    deviceId: string,
    data: TelemetryPayload | TelemetryPayload[],
  ) {
    const readings = Array.isArray(data) ? data : [data];
    if (readings.length === 0) return;

    for (const reading of readings) {
      if (!reading.sensorId || typeof reading.value !== 'number') {
        this.logger.warn(
          `Invalid telemetry payload from device ${deviceId}: ${JSON.stringify(reading)}`,
          TelemetryService.name,
        );
        continue;
      }

      const entry = {
        deviceId,
        sensorId: reading.sensorId,
        value: reading.value,
        unit: reading.unit || '',
        batchId: reading.batchId,
        timestamp: reading.timestamp || new Date().toISOString(),
      };

      this.inMemoryReadings.unshift(entry);
      if (this.inMemoryReadings.length > 200) {
        this.inMemoryReadings.pop();
      }

      this.logger.log(
        `📡 [Telemetry Received] Device: ${deviceId} | Sensor: ${reading.sensorId} | Value: ${reading.value} ${reading.unit || ''}`,
        TelemetryService.name,
      );
    }
  }

  private processDeviceStatus(deviceId: string, data: DeviceStatusPayload) {
    if (!data.status) return;

    this.logger.log(
      `🟢 [Device Status] Device: ${deviceId} | Status: ${data.status} ${data.processingStage ? `| Stage: ${data.processingStage}` : ''}`,
      TelemetryService.name,
    );
  }

  getReadings(query: TelemetryQueryDto) {
    const { batchId, sensorId, limit = 50 } = query;

    let filtered = this.inMemoryReadings;
    if (batchId) {
      filtered = filtered.filter((r) => r.batchId === batchId);
    }
    if (sensorId) {
      filtered = filtered.filter((r) => r.sensorId === sensorId);
    }

    return filtered.slice(0, limit);
  }

  getLatestByDevice(deviceId: string) {
    return this.inMemoryReadings
      .filter((r) => r.deviceId === deviceId)
      .slice(0, 10);
  }

  async sendCommandToDevice(deviceId: string, command: PublishCommandDto) {
    const topic = `sagana/devices/${deviceId}/commands`;
    await this.mqttService.publish(topic, command);

    this.logger.log(
      `Dispatched command '${command.action}' to device ${deviceId}`,
      TelemetryService.name,
    );

    return {
      success: true,
      deviceId,
      action: command.action,
      timestamp: new Date().toISOString(),
    };
  }
}
