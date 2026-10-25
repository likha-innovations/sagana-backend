import { Injectable, OnModuleInit } from '@nestjs/common';
import { LoggerService } from '../../core/logger/logger.service';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TelemetryGateway } from './telemetry.gateway';
import { PublishCommandDto } from './dto/publish-command.dto';

// Topic pattern: sagana/devices/<macAddress>/telemetry
const TELEMETRY_TOPIC_REGEX = /^sagana\/devices\/([^/]+)\/telemetry$/;

@Injectable()
export class TelemetryService implements OnModuleInit {
  constructor(
    private readonly mqttService: MqttService,
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly telemetryGateway: TelemetryGateway,
  ) {}

  onModuleInit() {
    this.mqttService.onMessage((topic, payload) => {
      void this.handleIncomingMqttMessage(topic, payload);
    });
  }

  async handleIncomingMqttMessage(topic: string, payload: Buffer) {
    try {
      const rawString = payload.toString();
      if (!rawString) return;

      const match = TELEMETRY_TOPIC_REGEX.exec(topic);
      if (!match) return; // ignore non-telemetry topics (e.g. retained system msgs)

      const macAddress = match[1];

      let parsedData: Record<string, unknown> = {};
      try {
        parsedData = JSON.parse(rawString) as Record<string, unknown>;
      } catch {
        parsedData = { raw: rawString };
      }

      // Look up machine by MAC to get the DB machineId
      const machine = await this.prisma.machine.findUnique({
        where: { macAddress },
        select: { id: true, name: true, barangayId: true },
      });

      if (!machine) {
        this.logger.warn(
          `Received telemetry from unknown MAC: ${macAddress}. Ignoring.`,
          TelemetryService.name,
        );
        return;
      }

      // Update lastSeen timestamp & persist raw telemetry
      await this.prisma.machine.update({
        where: { macAddress },
        data: { lastSeen: new Date() },
      });

      await this.prisma.telemetryLog.create({
        data: {
          machineId: machine.id,
          macAddress,
          payload: parsedData,
        },
      });

      const enrichedPayload = {
        machineId: machine.id,
        macAddress,
        name: machine.name,
        barangayId: machine.barangayId,
        timestamp: new Date().toISOString(),
        ...parsedData,
      };

      this.logger.log(
        `📥 [Telemetry Ingest] MAC=${macAddress} (id=${machine.id}): ${rawString}`,
        TelemetryService.name,
      );

      this.telemetryGateway.broadcastTelemetry(enrichedPayload);
    } catch (err) {
      this.logger.error(
        `Failed to process MQTT message from topic ${topic}: ${err instanceof Error ? err.message : err}`,
        TelemetryService.name,
      );
    }
  }

  async sendCommandToDevice(macAddress: string, command: PublishCommandDto) {
    const topic = `sagana/devices/${macAddress}/commands`;
    await this.mqttService.publish(topic, command);

    this.logger.log(
      `Dispatched command '${command.action}' to MAC ${macAddress}`,
      TelemetryService.name,
    );

    return {
      success: true,
      macAddress,
      action: command.action,
      timestamp: new Date().toISOString(),
    };
  }
}
