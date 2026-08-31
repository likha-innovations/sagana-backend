import { Injectable, OnModuleInit } from '@nestjs/common';
import { LoggerService } from '../../core/logger/logger.service';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';
import { TelemetryGateway } from './telemetry.gateway';
import { PublishCommandDto } from './dto/publish-command.dto';

@Injectable()
export class TelemetryService implements OnModuleInit {
  constructor(
    private readonly mqttService: MqttService,
    private readonly logger: LoggerService,
    private readonly telemetryGateway: TelemetryGateway,
  ) {}

  onModuleInit() {
    this.mqttService.onMessage((topic, payload) => {
      this.handleIncomingMqttMessage(topic, payload);
    });
  }

  handleIncomingMqttMessage(topic: string, payload: Buffer) {
    try {
      const rawString = payload.toString();
      if (!rawString) return;

      // Handle Ping / Pong test topics and bridge to Socket.IO
      if (topic === 'sagana/ping' || topic === 'sagana/pong') {
        const eventType = topic === 'sagana/ping' ? 'ping' : 'pong';
        this.telemetryGateway.broadcastMqttPingPong(eventType, {
          topic,
          message: rawString,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed to process MQTT message from topic ${topic}: ${err instanceof Error ? err.message : err}`,
        TelemetryService.name,
      );
    }
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
