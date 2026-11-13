import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';
import { TelemetryGateway } from '../telemetry/telemetry.gateway';
import type { RegisterMachineDto } from './dto/register-machine.dto';
import type { UpdateMachineDto } from './dto/update-machine.dto';
import type { AutomationLogsQueryDto } from './dto/automation-logs-query.dto';

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

    const where: {
      machineId: string;
      type?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = { machineId };

    if (query.type) {
      where.type = query.type;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = query.endDate.includes('T')
          ? new Date(query.endDate)
          : new Date(`${query.endDate}T23:59:59.999Z`);
      }
    }

    const logs = await this.prisma.automationLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
      skip: query.offset,
    });

    return logs.map((log) => ({
      id: log.id,
      machineId: log.machineId,
      batchId: log.batchId,
      type: log.type,
      message: log.message,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
    }));
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

    const [latestBlowerLog, latestSprinklerLog] = await Promise.all([
      this.prisma.automationLog.findFirst({
        where: {
          machineId,
          type: { in: ['blower_on', 'blower_off', 'emergency_stop'] },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.automationLog.findFirst({
        where: {
          machineId,
          type: { in: ['sprinkler_on', 'sprinkler_off'] },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    const blowerMeta =
      (latestBlowerLog?.metadata as Record<string, unknown> | null) ?? null;
    const sprinklerMeta =
      (latestSprinklerLog?.metadata as Record<string, unknown> | null) ?? null;

    const aerationUntil =
      (blowerMeta?.until as string) || (blowerRunning ? '6:07' : '15 min');

    const sprinklerUntil =
      (sprinklerMeta?.until as string) || (pumpRunning ? '60%' : '45%');

    return {
      machineId: machine.id,
      batchId: activeBatch?.id ?? null,
      currentWeight: activeBatch?.totalWeight ?? null,
      recordedAt: (latestTelemetry?.recordedAt ?? new Date()).toISOString(),
      automations: [
        {
          kind: 'aeration' as const,
          enabled: blowerRunning,
          until: aerationUntil,
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
