import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, type Notification } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';
import { TelemetryGateway } from '../telemetry/telemetry.gateway';
import type { RegisterMachineDto } from './dto/register-machine.dto';
import type { UpdateMachineDto } from './dto/update-machine.dto';
import type { AutomationLogsQueryDto } from './dto/automation-logs-query.dto';

function getEventTypeAliases(type: string): string[] {
  switch (type) {
    case 'sprinkler_on':
      return ['sprinkler_on', 'moisture_dosing_start', 'sprinkler_pulse_on'];
    case 'sprinkler_off':
      return [
        'sprinkler_off',
        'moisture_recovery_reached',
        'sprinkler_pulse_rest',
      ];
    case 'emergency_stop':
      return ['emergency_stop', 'estop_activated', 'e_stop'];
    default:
      return [type];
  }
}

@Injectable()
export class MachinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    @Optional() private readonly mqttService?: MqttService,
    @Optional() private readonly telemetryGateway?: TelemetryGateway,
  ) {}

  private async getBarangayId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { barangayId: true },
    });
    if (!user) {
      throw new NotFoundException('Authenticated user not found in database');
    }
    return user.barangayId;
  }

  async findAll(userId: string) {
    const barangayId = await this.getBarangayId(userId);
    if (!barangayId) return [];
    const machines = await this.prisma.machine.findMany({
      where: { barangayId, removedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return Promise.all(machines.map((m) => this.attachLatestReadings(m)));
  }

  async findOne(userId: string, id: string) {
    const barangayId = await this.getBarangayId(userId);
    const machine = barangayId
      ? await this.prisma.machine.findFirst({
          where: { id, barangayId, removedAt: null },
        })
      : null;
    if (!machine) throw new NotFoundException('Machine not found');
    return this.attachLatestReadings(machine);
  }

  private async attachLatestReadings<T extends { id: string }>(
    machine: T,
  ): Promise<
    T & {
      latestReadings?: {
        temperature: number | null;
        moisture: number | null;
        oxygen: number | null;
        co2: number | null;
        updatedAt: string;
      };
    }
  > {
    try {
      if (!this.prisma.sensorReading) {
        return machine;
      }

      const SENSOR_TYPES = [
        { key: 'temperature' as const, queryTypes: ['temperature'] },
        { key: 'moisture' as const, queryTypes: ['moisture'] },
        { key: 'oxygen' as const, queryTypes: ['oxygen', 'o2'] },
        { key: 'co2' as const, queryTypes: ['co2'] },
      ];

      const results = await Promise.all(
        SENSOR_TYPES.map(async ({ key, queryTypes }) => {
          const reading = await this.prisma.sensorReading.findFirst({
            where: {
              sensor: {
                machineId: machine.id,
                sensorType: { in: queryTypes },
              },
            },
            orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
          });
          return { key, reading };
        }),
      );

      let hasAnyReading = false;
      let latestTimestamp: Date | undefined;
      const values: {
        temperature: number | null;
        moisture: number | null;
        oxygen: number | null;
        co2: number | null;
      } = {
        temperature: null,
        moisture: null,
        oxygen: null,
        co2: null,
      };

      for (const { key, reading } of results) {
        if (reading) {
          hasAnyReading = true;
          values[key] = reading.value;
          if (!latestTimestamp || reading.recordedAt > latestTimestamp) {
            latestTimestamp = reading.recordedAt;
          }
        }
      }

      if (!hasAnyReading || !latestTimestamp) {
        return machine;
      }

      return {
        ...machine,
        latestReadings: {
          ...values,
          updatedAt: latestTimestamp.toISOString(),
        },
      };
    } catch {
      return machine;
    }
  }

  async update(userId: string, id: string, dto: UpdateMachineDto) {
    const machine = await this.findOne(userId, id);
    const data: { name?: string; wifiSsid?: string } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.wifiSsid !== undefined) data.wifiSsid = dto.wifiSsid;

    const updated = await this.prisma.machine.update({
      where: { id: machine.id },
      data,
    });

    if (dto.name !== undefined && machine.macAddress && this.mqttService) {
      await this.mqttService.publish(
        `sagana/devices/${machine.macAddress}/commands`,
        { action: 'SET_NAME', name: dto.name },
      );
    }

    if (this.telemetryGateway) {
      this.telemetryGateway.broadcastMachineUpdated({
        machineId: updated.id,
        name: updated.name,
        barangayId: machine.barangayId,
      });
    }

    this.logger.log(`Machine updated: id=${updated.id}`, MachinesService.name);
    return updated;
  }

  async remove(userId: string, id: string) {
    const machine = await this.findOne(userId, id);

    const removed = await this.prisma.machine.update({
      where: { id: machine.id },
      data: { removedAt: new Date(), status: 'inactive' },
    });

    if (this.telemetryGateway) {
      this.telemetryGateway.broadcastMachineRemoved({
        machineId: machine.id,
        barangayId: machine.barangayId,
      });
    }

    this.logger.log(`Machine removed: id=${removed.id}`, MachinesService.name);
    return { success: true, message: 'Machine removed successfully' };
  }

  async register(userId: string, dto: RegisterMachineDto) {
    this.logger.log(
      `User ${userId} registering machine MAC=${dto.macAddress}`,
      MachinesService.name,
    );

    // 1. Look up user's barangay_id
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { barangayId: true },
    });

    if (!user) {
      throw new NotFoundException('Authenticated user not found in database');
    }

    if (!user.barangayId) {
      throw new NotFoundException(
        'User is not associated with a barangay. Contact your administrator.',
      );
    }

    // 2. Check for duplicate MAC
    const existing = await this.prisma.machine.findUnique({
      where: { macAddress: dto.macAddress },
    });

    if (existing) {
      if (existing.barangayId !== user.barangayId) {
        throw new ConflictException(
          'This machine is already registered to a different barangay.',
        );
      }

      // Same barangay: device was re-provisioned (NVS wiped), restore credentials
      const machine = await this.prisma.machine.update({
        where: { macAddress: dto.macAddress },
        data: {
          name: dto.name,
          wifiSsid: dto.wifiSsid,
          status: 'active',
          removedAt: null,
        },
      });

      if (this.telemetryGateway) {
        this.telemetryGateway.broadcastMachineAdded({
          machineId: machine.id,
          name: machine.name,
          macAddress: machine.macAddress,
          barangayId: machine.barangayId ?? '',
          wifiSsid: machine.wifiSsid,
          status: machine.status,
          createdAt: machine.createdAt.toISOString(),
        });
      }

      this.logger.log(
        `Machine re-provisioned: id=${machine.id}`,
        MachinesService.name,
      );
      return machine;
    }

    // 3. Create the machine
    const machine = await this.prisma.machine.create({
      data: {
        barangayId: user.barangayId,
        macAddress: dto.macAddress,
        name: dto.name,
        wifiSsid: dto.wifiSsid,
        status: 'active',
      },
    });

    if (this.telemetryGateway) {
      this.telemetryGateway.broadcastMachineAdded({
        machineId: machine.id,
        name: machine.name,
        macAddress: machine.macAddress,
        barangayId: machine.barangayId,
        wifiSsid: machine.wifiSsid,
        status: machine.status,
        createdAt: machine.createdAt.toISOString(),
      });
    }

    this.logger.log(
      `Machine registered: id=${machine.id}`,
      MachinesService.name,
    );

    return machine;
  }

  async getAutomationLogs(
    userId: string,
    machineId: string,
    query: AutomationLogsQueryDto,
  ) {
    await this.findOne(userId, machineId);

    const where: Prisma.NotificationWhereInput = {
      machineId,
      type: 'automation',
    };

    const dates: { gte?: Date; lte?: Date } = {};
    if (query.startDate) dates.gte = new Date(query.startDate);
    if (query.endDate) {
      dates.lte = query.endDate.includes('T')
        ? new Date(query.endDate)
        : new Date(`${query.endDate}T23:59:59.999Z`);
    }
    if (dates.gte || dates.lte) where.createdAt = dates;

    const isBlowerFilter =
      query.type === 'blower_on' || query.type === 'blower_off';
    if (query.type && !isBlowerFilter) {
      const aliases = getEventTypeAliases(query.type);
      where.OR = aliases.map((alias) => ({
        metadata: {
          path: ['eventType'],
          equals: alias,
        },
      }));
    }

    const logs = isBlowerFilter
      ? await this.findBlowerLogs(machineId, query, dates)
      : await this.prisma.notification.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: query.limit,
          skip: query.offset,
        });

    return logs.map((log) => {
      const meta = (log.metadata as Record<string, unknown> | null) ?? {};
      let eventType = (meta.eventType as string) || log.type;

      if (
        eventType === 'aeration_state_change' ||
        eventType === 'blower_cycle_on' ||
        eventType === 'blower_cycle_rest'
      ) {
        const rawSpeed =
          typeof meta.speed === 'number' ? meta.speed : undefined;
        const stateStr = (
          typeof meta.state === 'string' ? meta.state : ''
        ).toUpperCase();
        const isOff =
          eventType === 'blower_cycle_rest' ||
          stateStr.includes('OFF') ||
          stateStr.includes('IDLE') ||
          rawSpeed === 0;
        eventType = isOff ? 'blower_off' : 'blower_on';
      } else if (
        eventType === 'moisture_dosing_start' ||
        eventType === 'sprinkler_pulse_on'
      ) {
        eventType = 'sprinkler_on';
      } else if (
        eventType === 'moisture_recovery_reached' ||
        eventType === 'sprinkler_pulse_rest'
      ) {
        eventType = 'sprinkler_off';
      } else if (eventType === 'estop_activated' || eventType === 'e_stop') {
        eventType = 'emergency_stop';
      }

      let formattedMessage = log.message;
      const lower = log.message.toLowerCase();
      const durationStr =
        typeof meta.durationMinutes === 'number' ||
        typeof meta.durationMinutes === 'string'
          ? String(meta.durationMinutes)
          : undefined;
      const targetMoistStr =
        typeof meta.targetMoisture === 'number' ||
        typeof meta.targetMoisture === 'string'
          ? String(meta.targetMoisture)
          : undefined;

      if (
        lower.includes('state transition') ||
        lower.includes('pulse') ||
        lower.includes('dosing sequence') ||
        lower.includes('hysteresis') ||
        lower.includes('test button')
      ) {
        if (eventType === 'blower_on') {
          formattedMessage = `The air blower has been turned on and will be running for ${durationStr ?? '5'} minutes.`;
        } else if (eventType === 'blower_off') {
          formattedMessage = `The air blower has been turned off and will be turned off for ${durationStr ?? '15'} minutes.`;
        } else if (eventType === 'sprinkler_on') {
          formattedMessage = `The sprinkler has been turned on and will be running until moisture hits ${targetMoistStr ?? '60'}%.`;
        } else if (eventType === 'sprinkler_off') {
          formattedMessage = `The sprinkler has been turned off as it already reached ${targetMoistStr ?? '60'}%.`;
        } else if (eventType === 'emergency_stop') {
          formattedMessage = lower.includes('sprinkler')
            ? 'The sprinkler has been stopped due to an emergency.'
            : 'The air blower has been stopped due to an emergency.';
        }
      }

      return {
        id: log.id,
        machineId: log.machineId,
        batchId: log.batchId,
        type: eventType,
        message: formattedMessage,
        metadata: log.metadata,
        createdAt: log.createdAt.toISOString(),
      };
    });
  }

  private findBlowerLogs(
    machineId: string,
    query: AutomationLogsQueryDto,
    dates: { gte?: Date; lte?: Date },
  ) {
    const off = query.type === 'blower_off';
    // Legacy transition records can represent either state. Match the same
    // numeric zero and state rules as the response mapping before pagination.
    const legacyOff = Prisma.sql`
      COALESCE(metadata->'speed' = '0'::jsonb, false)
      OR COALESCE(
        jsonb_typeof(metadata->'state') = 'string'
        AND metadata->>'state' ~* '(off|idle)',
        false
      )
    `;
    return this.prisma.$queryRaw<
      Pick<
        Notification,
        | 'id'
        | 'machineId'
        | 'batchId'
        | 'type'
        | 'message'
        | 'metadata'
        | 'createdAt'
      >[]
    >`
      SELECT notification_id AS id, machine_id AS "machineId",
             batch_id AS "batchId", type, message, metadata,
             created_at AS "createdAt"
      FROM notifications
      WHERE machine_id = ${machineId} AND type = 'automation'
        ${dates.gte ? Prisma.sql`AND created_at >= ${dates.gte}` : Prisma.empty}
        ${dates.lte ? Prisma.sql`AND created_at <= ${dates.lte}` : Prisma.empty}
        AND (
          metadata->>'eventType' = ${query.type}
          ${off ? Prisma.sql`OR metadata->>'eventType' = 'blower_cycle_rest'` : Prisma.empty}
          OR (
            metadata->>'eventType' IN ('aeration_state_change', 'blower_cycle_on')
            AND ${off ? Prisma.sql`(${legacyOff})` : Prisma.sql`NOT (${legacyOff})`}
          )
        )
      ORDER BY created_at DESC, notification_id DESC
      LIMIT ${query.limit} OFFSET ${query.offset}
    `;
  }

  async getOverview(userId: string, machineId: string) {
    const machine = await this.findOne(userId, machineId);

    const activeBatch = await this.prisma.compostBatch.findFirst({
      where: { machineId, status: 'active' },
      orderBy: { startDate: 'desc' },
    });

    const latestTelemetry = await this.prisma.telemetryLog.findFirst({
      where: { machineId },
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
    });

    const telemetryPayload =
      (latestTelemetry?.payload as Record<string, unknown> | null) ?? null;
    const actuators =
      (telemetryPayload?.actuators as Record<string, unknown> | null) ?? null;

    const blowerRunning = Boolean(
      actuators?.blower_running ||
      (typeof actuators?.blower_speed_percent === 'number' &&
        actuators.blower_speed_percent > 0),
    );
    const pumpRunning = Boolean(
      actuators?.pump_running ||
      (typeof actuators?.pump_speed_percent === 'number' &&
        actuators.pump_speed_percent > 0),
    );

    const blowerEventTypes = [
      'blower_on',
      'blower_off',
      'blower_cycle_on',
      'blower_cycle_rest',
      'emergency_stop',
      'e_stop',
    ];
    const sprinklerEventTypes = [
      'sprinkler_on',
      'sprinkler_off',
      'sprinkler_pulse_on',
      'sprinkler_pulse_rest',
      'moisture_dosing_start',
      'moisture_recovery_reached',
    ];

    const [latestBlowerLog, latestSprinklerLog] = await Promise.all([
      this.prisma.notification.findFirst({
        where: {
          machineId,
          type: 'automation',
          OR: blowerEventTypes.map((t) => ({
            metadata: { path: ['eventType'], equals: t },
          })),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.notification.findFirst({
        where: {
          machineId,
          type: 'automation',
          OR: sprinklerEventTypes.map((t) => ({
            metadata: { path: ['eventType'], equals: t },
          })),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    const blowerMeta =
      (latestBlowerLog?.metadata as Record<string, unknown> | null) ?? null;
    const sprinklerMeta =
      (latestSprinklerLog?.metadata as Record<string, unknown> | null) ?? null;

    const automation =
      (telemetryPayload?.automation as Record<string, unknown> | null) ?? null;
    const remainingMs =
      typeof automation?.aeration_remaining_ms === 'number'
        ? automation.aeration_remaining_ms
        : typeof actuators?.blower_remaining_ms === 'number'
          ? actuators.blower_remaining_ms
          : null;

    let dynamicUntil: string | null = null;
    if (remainingMs !== null && remainingMs > 0) {
      const totalSec = Math.round(remainingMs / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      if (mins >= 60) {
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        dynamicUntil = `${hrs}h ${remMins}m`;
      } else if (mins > 0) {
        dynamicUntil = `${mins}:${secs.toString().padStart(2, '0')}`;
      } else {
        dynamicUntil = `0:${secs.toString().padStart(2, '0')}`;
      }
    }

    const aerationUntil =
      dynamicUntil ||
      (blowerMeta?.until as string) ||
      (blowerRunning ? '10 min' : '5 min');

    const targetEndTime =
      remainingMs !== null && remainingMs > 0
        ? new Date(
            (latestTelemetry?.recordedAt
              ? new Date(latestTelemetry.recordedAt).getTime()
              : Date.now()) + remainingMs,
          ).toISOString()
        : null;

    const sprinklerUntil =
      (sprinklerMeta?.until as string) || (pumpRunning ? '60%' : '45%');

    return {
      machineId: machine.id,
      batchId: activeBatch?.id ?? null,
      currentWeight: activeBatch?.totalWeight ?? null,
      recordedAt: (latestTelemetry?.recordedAt ?? new Date()).toISOString(),
      serverTime: new Date().toISOString(),
      configuration: machine.configuration ?? {},
      automations: [
        {
          kind: 'aeration' as const,
          enabled: blowerRunning,
          until: aerationUntil,
          targetEndTime,
          remainingMs,
        },
        {
          kind: 'sprinkler' as const,
          enabled: pumpRunning,
          until: sprinklerUntil,
        },
      ],
    };
  }
}
