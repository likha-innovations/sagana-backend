import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const include = {
  machine: { select: { name: true } },
  feedstocks: { include: { feedstock: true } },
  compostOutput: true,
  compostingPhases: { orderBy: { startTime: 'asc' as const } },
};
type Batch = Prisma.CompostBatchGetPayload<{ include: typeof include }>;
type HistoryQuery = {
  startDate?: string;
  endDate?: string;
  offset: number;
  limit: number;
};

function present(batch: Batch) {
  return {
    id: batch.id,
    machineId: batch.machineId,
    userId: batch.userId,
    batchCode: batch.batchCode,
    status: batch.completionDate ? 'completed' : batch.status,
    startDate: batch.startDate,
    completionDate: batch.completionDate,
    totalWeight: batch.totalWeight,
    machineName: batch.machine.name,
    finalWeight: batch.compostOutput?.outputWeight ?? null,
    compostOutput: batch.compostOutput,
    compostingPhases: batch.compostingPhases,
    feedstocks: batch.feedstocks.map((item) => ({
      id: item.id,
      feedstockId: item.feedstockId,
      name: item.feedstock.name,
      category: item.feedstock.category,
      weightKg: item.weight,
    })),
  };
}

@Injectable()
export class BatchesService {
  constructor(private readonly prisma: PrismaService) {}

  private async barangay(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { barangayId: true },
    });
    if (!user) throw new NotFoundException('Authenticated user not found');
    return user.barangayId;
  }

  private async machine(userId: string, machineId: string) {
    const barangayId = await this.barangay(userId);
    const machine =
      barangayId &&
      (await this.prisma.machine.findFirst({
        where: { id: machineId, barangayId, removedAt: null },
      }));
    if (!machine) throw new NotFoundException('Machine not found');
    return machine;
  }

  async list(userId: string) {
    const barangayId = await this.barangay(userId);
    if (!barangayId) return [];
    const batches = await this.prisma.compostBatch.findMany({
      where: { machine: { barangayId, removedAt: null } },
      include,
      orderBy: { startDate: 'desc' },
    });
    return batches.map(present);
  }

  private async find(userId: string, id: string) {
    const barangayId = await this.barangay(userId);
    const batch =
      barangayId &&
      (await this.prisma.compostBatch.findFirst({
        where: { id, machine: { barangayId, removedAt: null } },
        include,
      }));
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  async get(userId: string, id: string) {
    return present(await this.find(userId, id));
  }

  async create(
    userId: string,
    input: { machineId: string; feedstocks: { id: string; weight: number }[] },
  ) {
    const machine = await this.machine(userId, input.machineId);
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT machine_id FROM machines WHERE machine_id = ${machine.id} FOR UPDATE`;
      const current = await tx.compostBatch.findFirst({
        where: {
          machineId: machine.id,
          status: 'active',
          completionDate: null,
        },
      });
      if (current)
        throw new ConflictException('Machine already has an active batch');
      const count = await tx.feedstock.count({
        where: {
          id: { in: input.feedstocks.map((item) => item.id) },
          status: 'active',
        },
      });
      if (count !== input.feedstocks.length)
        throw new BadRequestException('Invalid or inactive feedstock');
      return tx.compostBatch.create({
        data: {
          machineId: machine.id,
          userId,
          batchCode: `BATCH-${randomUUID()}`,
          totalWeight: input.feedstocks.reduce(
            (sum, item) => sum + item.weight,
            0,
          ),
          startDate: new Date(),
          feedstocks: {
            create: input.feedstocks.map((item) => ({
              feedstockId: item.id,
              weight: item.weight,
            })),
          },
        },
        include,
      });
    });
    return present(result);
  }

  async finish(userId: string, id: string, outputWeight?: number) {
    const batch = await this.find(userId, id);
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.compostBatch.updateMany({
        where: { id: batch.id, status: 'active', completionDate: null },
        data: { status: 'completed', completionDate: now },
      });
      if (updated.count !== 1)
        throw new ConflictException('Batch is not active');
      if (outputWeight !== undefined)
        await tx.compostOutput.create({
          data: {
            batchId: id,
            outputWeight,
            productionDate: now,
            status: 'ready_for_collection',
          },
        });
      const result = await tx.compostBatch.findUniqueOrThrow({
        where: { id },
        include,
      });
      return present(result);
    });
  }

  async history(
    userId: string,
    scope: { machineId: string } | { batchId: string },
    query: HistoryQuery,
  ) {
    const batch =
      'batchId' in scope ? await this.find(userId, scope.batchId) : null;
    const machine = await this.machine(
      userId,
      batch ? batch.machineId : (scope as { machineId: string }).machineId,
    );
    const start = query.startDate ? new Date(query.startDate) : undefined;
    const end = query.endDate ? new Date(query.endDate) : undefined;
    const [sensors, readings] = await Promise.all([
      this.prisma.sensor.findMany({ where: { machineId: machine.id } }),
      this.prisma.sensorReading.findMany({
        where: {
          sensor: { machineId: machine.id },
          ...(batch ? { batchId: batch.id } : {}),
          recordedAt: { gte: start, lte: end },
        },
        include: { sensor: true },
        orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
        skip: query.offset,
        take: query.limit + 1,
      }),
    ]);
    return {
      sensors,
      readings: readings.slice(0, query.limit).map((reading) => {
        const key =
          reading.sensor.sensorType === 'o2'
            ? 'oxygen'
            : reading.sensor.sensorType;
        const values = {
          temperature: null,
          moisture: null,
          oxygen: null,
          co2: null,
        };
        return {
          ...values,
          ...(key in values ? { [key]: reading.value } : {}),
          id: `reading:${reading.id}`,
          machineId: machine.id,
          batchId: reading.batchId,
          recordedAt: reading.recordedAt,
        };
      }),
      hasMore: readings.length > query.limit,
    };
  }
}
