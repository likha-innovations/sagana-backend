import { ConflictException, NotFoundException } from '@nestjs/common';
import { BatchesService } from './batches.service';
import type { PrismaService } from '../../infrastructure/database/prisma.service';

describe('BatchesService', () => {
  const user = { findUnique: jest.fn() };
  const machine = { findFirst: jest.fn() };
  const compostBatch = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
  };
  const sensor = { findMany: jest.fn() };
  const sensorReading = { findMany: jest.fn() };
  const telemetryLog = { findMany: jest.fn() };
  const tx = { compostBatch, compostOutput: { create: jest.fn() } };
  const prisma = {
    user,
    machine,
    compostBatch,
    sensor,
    sensorReading,
    telemetryLog,
    $transaction: (fn: (value: typeof tx) => unknown) => fn(tx),
  };
  const service = new BatchesService(prisma as unknown as PrismaService);
  beforeEach(() => jest.resetAllMocks());

  it('does not expose batches when the user has no barangay', async () => {
    user.findUnique.mockResolvedValue({ barangayId: null });
    expect(await service.list('user')).toEqual([]);
    expect(compostBatch.findMany).not.toHaveBeenCalled();
    await expect(service.get('user', 'batch')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('classifies a dated batch as completed without changing its stored status', async () => {
    user.findUnique.mockResolvedValue({ barangayId: 'barangay' });
    compostBatch.findFirst.mockResolvedValue({
      id: 'b',
      status: 'active',
      completionDate: new Date(),
      machine: { name: 'Machine' },
      feedstocks: [],
      compostOutput: null,
      compostingPhases: [],
    });
    const result = await service.get('user', 'b');
    expect(result.status).toBe('completed');
    expect(result.finalWeight).toBeNull();
    expect(compostBatch.findFirst.mock.calls[0][0].where.machine).toEqual({
      barangayId: 'barangay',
      removedAt: null,
    });
  });

  it('rejects a second finish before creating an output', async () => {
    user.findUnique.mockResolvedValue({ barangayId: 'barangay' });
    compostBatch.findFirst.mockResolvedValue({
      id: 'b',
      machine: { name: 'Machine' },
      feedstocks: [],
      compostOutput: null,
      compostingPhases: [],
    });
    compostBatch.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.finish('user', 'b', 2)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.compostOutput.create).not.toHaveBeenCalled();
  });

  it('finishes without inventing an output weight', async () => {
    user.findUnique.mockResolvedValue({ barangayId: 'barangay' });
    const batch = {
      id: 'b',
      status: 'completed',
      completionDate: new Date(),
      machine: { name: 'Machine' },
      feedstocks: [],
      compostOutput: null,
      compostingPhases: [],
    };
    compostBatch.findFirst.mockResolvedValue(batch);
    compostBatch.updateMany.mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = jest.fn().mockResolvedValue(batch);
    Object.assign(tx.compostBatch, { findUniqueOrThrow });
    const result = await service.finish('user', 'b');
    expect(result.finalWeight).toBeNull();
    expect(tx.compostOutput.create).not.toHaveBeenCalled();
  });

  it('paginates batch sensor readings without querying telemetry logs', async () => {
    user.findUnique.mockResolvedValue({ barangayId: 'barangay' });
    machine.findFirst.mockResolvedValue({ id: 'machine' });
    compostBatch.findFirst.mockResolvedValue({ id: 'b', machineId: 'machine' });
    sensor.findMany.mockResolvedValue([]);
    const recordedAt = new Date('2026-01-01T10:00:00Z');
    sensorReading.findMany.mockResolvedValue([
      {
        id: 'r1',
        batchId: 'b',
        recordedAt,
        value: 29.5,
        sensor: { sensorType: 'temperature' },
      },
      {
        id: 'r2',
        batchId: 'b',
        recordedAt,
        value: 50,
        sensor: { sensorType: 'moisture' },
      },
    ]);
    telemetryLog.findMany.mockResolvedValue([
      { id: 't', recordedAt, payload: { temperature: 99 } },
    ]);
    const result = await service.history(
      'user',
      { batchId: 'b' },
      { offset: 2, limit: 1 },
    );
    expect(telemetryLog.findMany).not.toHaveBeenCalled();
    expect(sensorReading.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          batchId: 'b',
          sensor: { machineId: 'machine' },
        }),
        skip: 2,
        take: 2,
      }),
    );
    expect(result.readings).toHaveLength(1);
    expect(result.readings[0]).toMatchObject({
      id: 'reading:r1',
      temperature: 29.5,
      batchId: 'b',
    });
    expect(result.readings[0]).not.toHaveProperty('source');
    expect(result.readings[0]).not.toHaveProperty('inferredBatch');
    expect(result.hasMore).toBe(true);
  });

  it('returns empty machine history even when telemetry exists', async () => {
    user.findUnique.mockResolvedValue({ barangayId: 'barangay' });
    machine.findFirst.mockResolvedValue({ id: 'machine' });
    sensor.findMany.mockResolvedValue([]);
    sensorReading.findMany.mockResolvedValue([]);
    telemetryLog.findMany.mockResolvedValue([
      { id: 't', payload: { temperature: 99 } },
    ]);
    const result = await service.history(
      'user',
      { machineId: 'machine' },
      { offset: 0, limit: 200 },
    );
    expect(result.readings).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(telemetryLog.findMany).not.toHaveBeenCalled();
    expect(sensorReading.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 201 }),
    );
  });
});
