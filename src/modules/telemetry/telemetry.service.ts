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
const EVENT_TOPIC_REGEX = /^sagana\/devices\/([^/]+)\/events$/;

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
          select: { id: true, name: true, barangayId: true, status: true },
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
        const previousStatus = machine.status;

        await this.prisma.machine.update({
          where: { macAddress },
          data: {
            status: machineStatus,
            lastSeen: isOnline ? new Date() : undefined,
          },
        });

        this.logger.log(
          `📡 [Device Status] MAC=${macAddress} (id=${machine.id}): ${machineStatus} (was ${previousStatus})`,
          TelemetryService.name,
        );

        if (isOnline && machine.name) {
          await this.mqttService.publish(
            `sagana/devices/${macAddress}/commands`,
            { action: 'SET_NAME', name: machine.name },
          );
        }

        this.telemetryGateway.broadcastStatus({
          machineId: machine.id,
          macAddress,
          status: machineStatus,
          barangayId: machine.barangayId,
        });

        // Generate and broadcast alert only on state transition to avoid spamming
        const hasTransitioned = previousStatus !== machineStatus;

        if (hasTransitioned && machine.barangayId) {
          if (!isOnline) {
            const notif = await this.prisma.notification.create({
              data: {
                barangayId: machine.barangayId,
                machineId: machine.id,
                type: 'machine',
                severity: 'warning',
                title: `${machine.name || 'Machine'} Offline`,
                message: `${machine.name || 'Machine'} has disconnected or gone offline.`,
                metadata: { macAddress, status: machineStatus },
              },
            });
            this.telemetryGateway.broadcastNotification(machine.barangayId, {
              id: notif.id,
              barangayId: notif.barangayId,
              machineId: notif.machineId,
              batchId: notif.batchId,
              userId: notif.userId,
              type: notif.type,
              severity: notif.severity,
              title: notif.title,
              message: notif.message,
              metadata: notif.metadata,
              isRead: notif.isRead,
              readAt: notif.readAt ? notif.readAt.toISOString() : null,
              createdAt: notif.createdAt.toISOString(),
            });
          } else if (previousStatus === 'offline') {
            const notif = await this.prisma.notification.create({
              data: {
                barangayId: machine.barangayId,
                machineId: machine.id,
                type: 'machine',
                severity: 'info',
                title: `${machine.name || 'Machine'} Back Online`,
                message: `${machine.name || 'Machine'} has reconnected and resumed telemetry streaming.`,
                metadata: { macAddress, status: machineStatus },
              },
            });
            this.telemetryGateway.broadcastNotification(machine.barangayId, {
              id: notif.id,
              barangayId: notif.barangayId,
              machineId: notif.machineId,
              batchId: notif.batchId,
              userId: notif.userId,
              type: notif.type,
              severity: notif.severity,
              title: notif.title,
              message: notif.message,
              metadata: notif.metadata,
              isRead: notif.isRead,
              readAt: notif.readAt ? notif.readAt.toISOString() : null,
              createdAt: notif.createdAt.toISOString(),
            });
          }
        }
        return;
      }

      // 2. Automation event stream (discrete state changes: blower, sprinkler, e-stop)
      const eventMatch = EVENT_TOPIC_REGEX.exec(topic);
      if (eventMatch) {
        const macAddress = eventMatch[1];
        let eventPayload: Record<string, unknown> = {};
        try {
          eventPayload = JSON.parse(rawString) as Record<string, unknown>;
        } catch {
          eventPayload = { raw: rawString };
        }

        const machine = await this.prisma.machine.findUnique({
          where: { macAddress },
          include: {
            batches: {
              where: { status: 'active' },
              take: 1,
            },
          },
        });

        if (!machine) {
          this.logger.warn(
            `Received event from unknown MAC: ${macAddress}. Ignoring.`,
            TelemetryService.name,
          );
          return;
        }

        const activeBatch = machine.batches[0];
        const type = (eventPayload.type as string) || 'unknown';
        const message =
          (eventPayload.message as string) ||
          this.formatAutomationMessage(type, eventPayload);
        const metadata =
          (eventPayload.metadata as Prisma.InputJsonObject) ??
          (eventPayload as Prisma.InputJsonObject);

        const log = await this.prisma.automationLog.create({
          data: {
            machineId: machine.id,
            batchId: activeBatch?.id ?? null,
            type,
            message,
            metadata,
          },
        });

        this.logger.log(
          `⚡ [Automation Event] MAC=${macAddress} (machineId=${machine.id}): ${type} - ${message}`,
          TelemetryService.name,
        );

        this.telemetryGateway.broadcastAutomationLog({
          ...log,
          macAddress,
          barangayId: machine.barangayId,
        });

        // Trigger notification on emergency stop / alarm or door/lid events
        const isCritical =
          type === 'emergency_stop' || type === 'e_stop' || type === 'alarm';
        const isDoorEvent =
          type === 'top_lid_opened' ||
          type === 'top_lid_closed' ||
          type === 'middle_door_opened' ||
          type === 'middle_door_closed';

        if ((isCritical || isDoorEvent) && machine.barangayId) {
          let title = 'Emergency Stop Triggered';
          let severity = 'critical';
          let notifType = 'automation';

          if (isDoorEvent) {
            severity = 'info';
            notifType = 'machine';
            switch (type) {
              case 'top_lid_opened':
                title = `${machine.name || 'Machine'} Top Lid Opened`;
                break;
              case 'top_lid_closed':
                title = `${machine.name || 'Machine'} Top Lid Closed`;
                break;
              case 'middle_door_opened':
                title = `${machine.name || 'Machine'} Middle Door Opened`;
                break;
              case 'middle_door_closed':
                title = `${machine.name || 'Machine'} Middle Door Closed`;
                break;
            }
          }

          const notif = await this.prisma.notification.create({
            data: {
              barangayId: machine.barangayId,
              machineId: machine.id,
              batchId: activeBatch?.id ?? null,
              type: notifType,
              severity,
              title,
              message: `${machine.name || 'Machine'}: ${message}`,
              metadata: {
                ...(metadata as Record<string, unknown>),
                macAddress,
                logId: log.id,
                eventType: type,
              },
            },
          });
          this.telemetryGateway.broadcastNotification(machine.barangayId, {
            id: notif.id,
            barangayId: notif.barangayId,
            machineId: notif.machineId,
            batchId: notif.batchId,
            userId: notif.userId,
            type: notif.type,
            severity: notif.severity,
            title: notif.title,
            message: notif.message,
            metadata: notif.metadata,
            isRead: notif.isRead,
            readAt: notif.readAt ? notif.readAt.toISOString() : null,
            createdAt: notif.createdAt.toISOString(),
          });
        }
        return;
      }

      // 3. Sensor telemetry stream
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

      // Trigger critical sensor notification if temperature exceeds safety threshold (75°C)
      const temp =
        typeof parsedData.temperature === 'number'
          ? parsedData.temperature
          : null;
      if (temp !== null && temp > 75 && machine.barangayId) {
        const notif = await this.prisma.notification.create({
          data: {
            barangayId: machine.barangayId,
            machineId: machine.id,
            type: 'sensor',
            severity: 'critical',
            title: 'High Temperature Alert',
            message: `${machine.name || 'Machine'} recorded core temperature of ${temp}°C exceeding threshold.`,
            metadata: { temperature: temp, macAddress },
          },
        });
        this.telemetryGateway.broadcastNotification(machine.barangayId, {
          id: notif.id,
          barangayId: notif.barangayId,
          machineId: notif.machineId,
          batchId: notif.batchId,
          userId: notif.userId,
          type: notif.type,
          severity: notif.severity,
          title: notif.title,
          message: notif.message,
          metadata: notif.metadata,
          isRead: notif.isRead,
          readAt: notif.readAt ? notif.readAt.toISOString() : null,
          createdAt: notif.createdAt.toISOString(),
        });
      }
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

  private formatAutomationMessage(
    type: string,
    payload: Record<string, unknown>,
  ): string {
    const rawDuration =
      payload.durationMinutes ??
      (typeof payload.durationSeconds === 'number'
        ? Math.round(payload.durationSeconds / 60)
        : undefined);
    const duration =
      typeof rawDuration === 'number' || typeof rawDuration === 'string'
        ? String(rawDuration)
        : undefined;

    const rawMoisture = payload.targetMoisture ?? payload.moistureTarget;
    const targetMoisture =
      typeof rawMoisture === 'number' || typeof rawMoisture === 'string'
        ? String(rawMoisture)
        : undefined;

    switch (type) {
      case 'blower_on':
        return `The air blower has been turned on and will be running for ${duration ?? '5'} minutes.`;
      case 'blower_off':
        return `The air blower has been turned off and will be turned off for ${duration ?? '15'} minutes.`;
      case 'sprinkler_on':
        return `The sprinkler has been turned on and will be running until moisture hits ${targetMoisture ?? '60'}%.`;
      case 'sprinkler_off':
        return `The sprinkler has been turned off as it already reached ${targetMoisture ?? '60'}%.`;
      case 'emergency_stop':
        return 'The air blower has been stopped due to an emergency.';
      case 'top_lid_opened':
        return 'Feedstock top lid opened';
      case 'top_lid_closed':
        return 'Feedstock top lid closed';
      case 'middle_door_opened':
        return 'Compost middle door opened';
      case 'middle_door_closed':
        return 'Compost middle door closed';
      case 'actuator_extending':
        return 'Linear actuator raising floor';
      case 'actuator_extended':
        return 'Linear actuator floor raised';
      case 'actuator_retracting':
        return 'Linear actuator dropping floor';
      case 'actuator_retracted':
        return 'Linear actuator floor lowered';
      default:
        return `Automation event: ${type}`;
    }
  }
}
