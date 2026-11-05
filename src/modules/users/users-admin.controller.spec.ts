import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { verifyToken } from '@clerk/backend';
import request from 'supertest';
import { AppController } from '../../app.controller';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { TransformResponseInterceptor } from '../../core/interceptors/transform-response.interceptor';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';
import { BatchesController } from '../batches/batches.controller';
import { BatchesService } from '../batches/batches.service';
import { MachinesController } from '../machines/machines.controller';
import { MachinesService } from '../machines/machines.service';
import { UsersAdminController } from './users-admin.controller';
import { UsersOperatorController } from './users-operator.controller';
import { UsersService } from './users.service';

jest.mock('@clerk/backend', () => ({ verifyToken: jest.fn() }));

describe('Admin authorization', () => {
  let app: INestApplication;
  const users: Record<
    string,
    { id: string; role: string; barangayId: string | null }
  > = {
    admin: { id: 'admin', role: 'admin', barangayId: 'b1' },
    operator: { id: 'operator', role: 'operator', barangayId: 'b1' },
    unassigned: { id: 'unassigned', role: 'admin', barangayId: null },
  };
  const operators = [
    {
      id: 'one',
      role: 'operator',
      barangayId: 'b1',
      barangay: { id: 'b1', name: 'Barangay 1' },
    },
    {
      id: 'two',
      role: 'operator',
      barangayId: 'b2',
      barangay: { id: 'b2', name: 'Barangay 2' },
    },
  ];
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(users[where.id] ?? null),
      ),
      findMany: jest.fn(
        ({ where }: { where: { barangayId: string; role: string } }) =>
          Promise.resolve(
            operators.filter(
              (user) =>
                user.barangayId === where.barangayId &&
                user.role === where.role,
            ),
          ),
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: { barangayId?: string };
        }) => Promise.resolve({ ...users[where.id], ...data }),
      ),
    },
  };
  const batches = {
    history: jest
      .fn()
      .mockResolvedValue({ readings: [], sensors: [], hasMore: false }),
  };
  const machines = { findAll: jest.fn().mockResolvedValue([]) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        AppController,
        UsersOperatorController,
        UsersAdminController,
        BatchesController,
        MachinesController,
      ],
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
        },
        { provide: BatchesService, useValue: batches },
        { provide: MachinesService, useValue: machines },
        { provide: APP_GUARD, useClass: ClerkAuthGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalInterceptors(new TransformResponseInterceptor());
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(verifyToken).mockImplementation((token) => {
      if (token === 'invalid')
        return Promise.reject(new Error('Invalid token'));
      return Promise.resolve({ sub: token } as never);
    });
  });
  afterAll(async () => app.close());

  it('returns only same-barangay operators in the existing response envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/admin/operators')
      .auth('admin', { type: 'bearer' })
      .expect(200);
    expect(response.body.data).toEqual([operators[0]]);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { role: 'operator', barangayId: 'b1' },
      include: { barangay: true },
      orderBy: { createdAt: 'desc' },
    });
  });
  it.each(['operator', 'missing', 'unassigned'])(
    'denies %s',
    async (userId) => {
      await request(app.getHttpServer())
        .get('/admin/operators')
        .auth(userId, { type: 'bearer' })
        .expect(403);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    },
  );
  it('requires a valid token', async () => {
    await request(app.getHttpServer()).get('/admin/operators').expect(401);
    await request(app.getHttpServer())
      .get('/admin/operators')
      .auth('invalid', { type: 'bearer' })
      .expect(401);
  });
  it('does not trust an admin role in the token when the database role is operator', async () => {
    jest
      .mocked(verifyToken)
      .mockResolvedValue({ sub: 'operator', role: 'admin' } as never);
    await request(app.getHttpServer())
      .get('/admin/operators')
      .auth('operator', { type: 'bearer' })
      .expect(403);
  });
  it.each(['admin', 'operator'])(
    'keeps profile and sensor history accessible to %s',
    async (userId) => {
      await request(app.getHttpServer())
        .get('/me')
        .auth(userId, { type: 'bearer' })
        .expect(200);
      await request(app.getHttpServer())
        .patch('/me')
        .auth(userId, { type: 'bearer' })
        .send({ barangayId: 'b2' })
        .expect(200);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: { barangayId: 'b2' },
        }),
      );
      await request(app.getHttpServer())
        .get('/machines')
        .auth(userId, { type: 'bearer' })
        .expect(200);
      await request(app.getHttpServer())
        .get('/machines/m1/readings')
        .auth(userId, { type: 'bearer' })
        .expect(200);
      expect(batches.history).toHaveBeenCalledWith(
        userId,
        { machineId: 'm1' },
        expect.any(Object),
      );
    },
  );
  it('keeps the health route public', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});
