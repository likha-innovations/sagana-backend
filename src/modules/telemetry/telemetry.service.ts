import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LoggerService } from '../../core/logger/logger.service';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TelemetryGateway } from './telemetry.gateway';
import { PublishCommandDto } from './dto/publish-command.dto';

// Topic patterns
const TELEMETRY_TOPIC_REGEX = /^sagana\/devices\/([^/]+)\/telemetry$/;
const STATUS_TOPIC_REGEX = /^sagana\/devices\/([^/]+)\/status$/;

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

      // 1. Device online / offline status (from LWT or status topic)
      const statusMatch = STATUS_TOPIC_REGEX.exec(topic);
      if (statusMatch) {
        const macAddress = statusMatch[1];
        let statusData: { status?: string } = {};
        try {
          statusData = JSON.parse(rawString) as { status?: string };
        } catch {
          statusData = { status: rawString };
        }

        const machine = await this.prisma.machine.findUnique({
          where: { macAddress },
          select: { id: true, name: true, barangayId: true },
        });

        if (!machine) {
          this.logger.warn(
            `Received status from unknown MAC: ${macAddress}. Ignoring.`,
            TelemetryService.name,
          );
          return;
        }

        const isOnline = statusData.status === 'online';
        const machineStatus = isOnline ? 'active' : 'offline';

        await this.prisma.machine.update({
          where: { macAddress },
          data: {
            status: machineStatus,
            lastSeen: isOnline ? new Date() : undefined,
          },
        });

        this.logger.log(
          `📡 [Device Status] MAC=${macAddress} (id=${machine.id}): ${machineStatus}`,
          TelemetryService.name,
        );

        this.telemetryGateway.broadcastStatus({
          machineId: machine.id,
          macAddress,
          status: machineStatus,
        });
        return;
      }

      // 2. Sensor telemetry stream
      const telemetryMatch = TELEMETRY_TOPIC_REGEX.exec(topic);
      if (!telemetryMatch) return;

      const macAddress = telemetryMatch[1];

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

      // Update lastSeen timestamp, ensure active status & persist raw telemetry
      await this.prisma.machine.update({
        where: { macAddress },
        data: { lastSeen: new Date(), status: 'active' },
      });

      await this.prisma.telemetryLog.create({
        data: {
          machineId: machine.id,
          macAddress,
          payload: parsedData as Prisma.InputJsonObject,
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
