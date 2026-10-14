import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { verifyToken } from '@clerk/backend';
import { MachinesController } from './machines.controller';
import { MachinesService } from './machines.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { TransformResponseInterceptor } from '../../core/interceptors/transform-response.interceptor';

jest.mock('@clerk/backend', () => ({ verifyToken: jest.fn() }));

describe('Machine read access', () => {
  let app: INestApplication;
  const machines = [
    { id: 'neo2', barangayId: 'brgy_176', removedAt: null },
    { id: 'other', barangayId: 'brgy_177', removedAt: null },
    {
      id: 'removed',
      barangayId: 'brgy_176',
      removedAt: new Date(),
    },
  ];
  const matching = (where: Record<string, unknown>) =>
    machines.filter((machine) =>
      Object.entries(where).every(([key, value]) => machine[key] === value),
    );
  const prisma = {
    user: { findUnique: jest.fn() },
    machine: {
      findMany: jest.fn(({ where }) => matching(where)),
      findFirst: jest.fn(({ where }) => matching(where)[0] ?? null),
    },
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MachinesController],
      providers: [
        MachinesService,
        { provide: PrismaService, useValue: prisma },
        { provide: LoggerService, useValue: { log: jest.fn() } },
        { provide: APP_GUARD, useClass: ClerkAuthGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalInterceptors(new TransformResponseInterceptor());
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(verifyToken).mockResolvedValue({ sub: 'account' } as never);
    prisma.user.findUnique.mockResolvedValue({ barangayId: 'brgy_176' });
  });

  afterAll(() => app.close());

  it('lists only same-barangay non-removed machines and ignores supplied scope', async () => {
    const response = await request(app.getHttpServer())
      .get('/machines?barangayId=brgy_177')
      .auth('valid', { type: 'bearer' })
      .expect(200);
    expect(response.body.data).toEqual([machines[0]]);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'account' },
      select: { barangayId: true },
    });
    expect(prisma.machine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { barangayId: 'brgy_176', removedAt: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('opens a matching machine', async () => {
    const response = await request(app.getHttpServer())
      .get('/machines/neo2')
      .auth('valid', { type: 'bearer' })
      .expect(200);
    expect(response.body.data).toEqual(machines[0]);
  });

  it.each(['other', 'removed', 'missing'])(
    'hides inaccessible detail %s',
    async (id) => {
      await request(app.getHttpServer())
        .get(`/machines/${id}`)
        .auth('valid', { type: 'bearer' })
        .expect(404);
    },
  );

  it('returns no machines for an unassigned account', async () => {
    prisma.user.findUnique.mockResolvedValue({ barangayId: null });
    const response = await request(app.getHttpServer())
      .get('/machines')
      .auth('valid', { type: 'bearer' })
      .expect(200);
    expect(response.body.data).toEqual([]);
    await request(app.getHttpServer())
      .get('/machines/neo2')
      .auth('valid', { type: 'bearer' })
      .expect(404);
    expect(prisma.machine.findMany).not.toHaveBeenCalled();
    expect(prisma.machine.findFirst).not.toHaveBeenCalled();
  });

  it('returns an empty list for a barangay without machines', async () => {
    prisma.user.findUnique.mockResolvedValue({ barangayId: 'brgy_180' });
    const response = await request(app.getHttpServer())
      .get('/machines')
      .auth('valid', { type: 'bearer' })
      .expect(200);
    expect(response.body.data).toEqual([]);
  });

  it.each(['/machines', '/machines/neo2'])(
    'rejects missing profiles at %s',
    async (path) => {
      prisma.user.findUnique.mockResolvedValue(null);
      await request(app.getHttpServer())
        .get(path)
        .auth('valid', { type: 'bearer' })
        .expect(404);
    },
  );

  it.each(['/machines', '/machines/neo2'])(
    'requires valid authentication at %s',
    async (path) => {
      await request(app.getHttpServer()).get(path).expect(401);
      jest.mocked(verifyToken).mockRejectedValue(new Error('Invalid token'));
      await request(app.getHttpServer())
        .get(path)
        .auth('invalid', { type: 'bearer' })
        .expect(401);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    },
  );
});
