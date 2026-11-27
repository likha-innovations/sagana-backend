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
          select: {
            id: true,
            name: true,
            barangayId: true,
            status: true,
            configuration: true,
          },
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

        // Device Twin: push saved aeration config on reconnect
        const aerationConfig = (
          machine.configuration as Record<string, unknown> | null
        )?.aeration as Record<string, unknown> | undefined;
        if (
          isOnline &&
          aerationConfig &&
          Object.keys(aerationConfig).length > 0
        ) {
          await this.mqttService.publish(
            `sagana/devices/${macAddress}/commands`,
            { action: 'AERATION_CONFIG', payload: aerationConfig },
          );
          this.logger.log(
            `📡 [Device Twin] Pushed AERATION_CONFIG to ${macAddress} on reconnect`,
            TelemetryService.name,
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
        let type = (eventPayload.type as string) || 'unknown';
        const metaObj =
          (eventPayload.metadata as Record<string, unknown>) ?? eventPayload;

        // Normalize legacy or raw firmware state transition event types
        if (
          type === 'aeration_state_change' ||
          type === 'blower_cycle_on' ||
          type === 'blower_cycle_rest'
        ) {
          const rawSpeed =
            typeof metaObj.speed === 'number'
              ? metaObj.speed
              : typeof eventPayload.speed === 'number'
                ? eventPayload.speed
                : undefined;
          const stateStr = (
            typeof metaObj.state === 'string'
              ? metaObj.state
              : typeof eventPayload.state === 'string'
                ? eventPayload.state
                : ''
          ).toUpperCase();
          const isOff =
            type === 'blower_cycle_rest' ||
            stateStr.includes('OFF') ||
            stateStr.includes('IDLE') ||
            rawSpeed === 0;
          type = isOff ? 'blower_off' : 'blower_on';
        } else if (
          type === 'moisture_dosing_start' ||
          type === 'sprinkler_pulse_on'
        ) {
          type = 'sprinkler_on';
        } else if (
          type === 'moisture_recovery_reached' ||
          type === 'sprinkler_pulse_rest'
        ) {
          type = 'sprinkler_off';
        } else if (type === 'estop_activated' || type === 'e_stop') {
          type = 'emergency_stop';
        }

        // Format user-friendly message, replacing generic transition descriptions
        const rawMsg =
          typeof eventPayload.message === 'string' ? eventPayload.message : '';
        const isGenericMessage =
          !rawMsg ||
          rawMsg.toLowerCase().includes('state transition') ||
          rawMsg.toLowerCase().includes('pulse') ||
          rawMsg.toLowerCase().includes('dosing sequence') ||
          rawMsg.toLowerCase().includes('hysteresis') ||
          rawMsg.toLowerCase().includes('test button');

        const message = isGenericMessage
          ? this.formatAutomationMessage(type, { ...metaObj, ...eventPayload })
          : rawMsg;

        const metadata =
          (eventPayload.metadata as Prisma.InputJsonObject) ??
          (eventPayload as Prisma.InputJsonObject);

        // Emergency stop and alarms trigger critical notifications; doors trigger machine events
        const isCritical =
          type === 'emergency_stop' || type === 'e_stop' || type === 'alarm';
        const isDoorEvent =
          type === 'top_lid_opened' ||
          type === 'top_lid_closed' ||
          type === 'middle_door_opened' ||
          type === 'middle_door_closed';
        const isCollectionNotice = type === 'collection_screen_required';

        const notifType =
          isDoorEvent || isCollectionNotice ? 'machine' : 'automation';
        const severity = isCritical
          ? 'critical'
          : isCollectionNotice
            ? 'warning'
            : 'info';
        const title = this.formatAutomationTitle(
          machine.name || 'Machine',
          type,
        );
        const notifMessage = isCollectionNotice
          ? `To lift or lower the floor of ${machine.name || 'this machine'}, open the Collection or Rejection process screen in the app first.`
          : isCritical || isDoorEvent
            ? `${machine.name || 'Machine'}: ${message}`
            : message;

        let notif: {
          id: string;
          barangayId: string;
          machineId: string | null;
          batchId: string | null;
          userId: string | null;
          type: string;
          severity: string;
          title: string;
          message: string;
          metadata: unknown;
          isRead: boolean;
          readAt: Date | null;
          createdAt: Date;
        } | null = null;

        if (machine.barangayId) {
          notif = await this.prisma.notification.create({
            data: {
              barangayId: machine.barangayId,
              machineId: machine.id,
              batchId: activeBatch?.id ?? null,
              type: notifType,
              severity,
              title,
              message: notifMessage,
              metadata: {
                ...(metadata as Record<string, unknown>),
                macAddress,
                eventType: type,
              },
            },
          });

          // Only broadcast to notification bell feed if critical, security/door event, or collection screen reminder
          if (isCritical || isDoorEvent || isCollectionNotice) {
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

        this.logger.log(
          `⚡ [Automation Event] MAC=${macAddress} (machineId=${machine.id}): ${type} - ${message}`,
          TelemetryService.name,
        );

        this.telemetryGateway.broadcastAutomationLog({
          id: notif?.id ?? `auto-${Date.now()}`,
          machineId: machine.id,
          batchId: activeBatch?.id ?? null,
          type,
          message,
          metadata: {
            ...(metadata as Record<string, unknown>),
            macAddress,
            eventType: type,
          },
          createdAt: notif
            ? notif.createdAt.toISOString()
            : new Date().toISOString(),
          macAddress,
          barangayId: machine.barangayId,
        });

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

    // Device Twin: Persist actuator configuration changes to database atomically
    if (command.action === 'AERATION_CONFIG' && command.payload) {
      const updatedMachine = await this.prisma.$transaction(
        async (tx) => {
          // Serialize merges for this machine; a lock failure rejects the
          // request without retrying the command already published to MQTT.
          const [machine] = await tx.$queryRaw<
            { id: string; configuration: Prisma.JsonValue }[]
          >`
            SELECT "machine_id" AS id, "configuration"
            FROM "machines"
            WHERE "mac_address" = ${macAddress}
            FOR UPDATE
          `;
          if (!machine) return null;

          const currentConfig =
            (machine.configuration as Record<string, unknown> | null) ?? {};
          const newConfig = {
            ...currentConfig,
            aeration: {
              ...((currentConfig.aeration as Record<string, unknown> | null) ??
                {}),
              ...command.payload,
              updatedAt: new Date().toISOString(),
            },
          };
          return tx.machine.update({
            where: { id: machine.id },
            data: { configuration: newConfig },
            select: { id: true, barangayId: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );

      if (updatedMachine) {
        this.telemetryGateway.broadcastMachineUpdated({
          machineId: updatedMachine.id,
          barangayId: updatedMachine.barangayId,
        });
      }
    }

    return {
      success: true,
      macAddress,
      action: command.action,
      timestamp: new Date().toISOString(),
    };
  }

  private formatAutomationTitle(
    machineName: string,
    eventType: string,
  ): string {
    const prefix = machineName ? `${machineName}: ` : '';
    switch (eventType) {
      case 'blower_on':
        return `${prefix}Aeration Blower Started`;
      case 'blower_off':
        return `${prefix}Aeration Blower Stopped`;
      case 'sprinkler_on':
        return `${prefix}Sprinkler Dosing Started`;
      case 'sprinkler_off':
        return `${prefix}Sprinkler Dosing Stopped`;
      case 'sprinkler_pulse_on':
        return `${prefix}Sprinkler Pulse Active`;
      case 'sprinkler_pulse_rest':
        return `${prefix}Sprinkler Pulse Resting`;
      case 'moisture_dosing_start':
        return `${prefix}Moisture Dosing Initiated`;
      case 'moisture_recovery_reached':
        return `${prefix}Target Moisture Reached`;
      case 'emergency_stop':
      case 'e_stop':
        return 'Emergency Stop Triggered';
      case 'top_lid_opened':
        return `${machineName || 'Machine'} Top Lid Opened`;
      case 'top_lid_closed':
        return `${machineName || 'Machine'} Top Lid Closed`;
      case 'middle_door_opened':
        return `${machineName || 'Machine'} Middle Door Opened`;
      case 'middle_door_closed':
        return `${machineName || 'Machine'} Middle Door Closed`;
      case 'actuator_extending':
        return `${prefix}Floor Raising`;
      case 'actuator_extended':
        return `${prefix}Floor Raised`;
      case 'actuator_retracting':
        return `${prefix}Floor Lowering`;
      case 'actuator_retracted':
        return `${prefix}Floor Lowered`;
      case 'collection_screen_required':
        return `${prefix}Collection Screen Required`;
      default:
        return `${prefix}Automation Event (${eventType})`;
    }
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
      case 'e_stop':
      case 'estop_activated': {
        const payloadMsg =
          typeof payload.message === 'string'
            ? payload.message.toLowerCase()
            : '';
        if (
          payload.actuator === 'sprinkler' ||
          payloadMsg.includes('sprinkler')
        ) {
          return 'The sprinkler has been stopped due to an emergency.';
        }
        return 'The air blower has been stopped due to an emergency.';
      }
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
