import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { verifyToken } from '@clerk/backend';
import request from 'supertest';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { BarangaysController } from './barangays.controller';
import { BarangaysService } from './barangays.service';

jest.mock('@clerk/backend', () => ({ verifyToken: jest.fn() }));

describe('Barangay code endpoints', () => {
  let app: INestApplication;
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id === 'admin'
            ? { role: 'admin', barangayId: 'b1' }
            : { role: 'operator', barangayId: 'b1' },
        ),
      ),
    },
    barangay: {
      findFirst: jest.fn().mockResolvedValue({ id: 'b1', name: 'Barangay 1' }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ code: 'ABC123' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  beforeEach(async () => {
    jest
      .mocked(verifyToken)
      .mockImplementation((token) => Promise.resolve({ sub: token } as never));
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
      controllers: [BarangaysController],
      providers: [
        BarangaysService,
        { provide: PrismaService, useValue: prisma },
        { provide: APP_GUARD, useClass: ClerkAuthGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(async () => app.close());

  it('validates publicly without returning the code', async () => {
    const result = await request(app.getHttpServer())
      .post('/barangays/validate-code')
      .send({ code: 'abc123' })
      .expect(201);
    expect(result.body).toEqual({ id: 'b1', name: 'Barangay 1' });
  });

  it('restricts code viewing and rotation to admins', async () => {
    await request(app.getHttpServer()).get('/barangays/admin/code').expect(401);
    await request(app.getHttpServer())
      .get('/barangays/admin/code')
      .auth('operator', { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/barangays/admin/code/rotate')
      .auth('operator', { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/barangays/admin/code')
      .auth('admin', { type: 'bearer' })
      .expect(200, { code: 'ABC123' });
    await request(app.getHttpServer())
      .post('/barangays/admin/code/rotate')
      .auth('admin', { type: 'bearer' })
      .expect(201);
  });

  it('rate-limits code attempts', async () => {
    for (let i = 0; i < 10; i++)
      await request(app.getHttpServer())
        .post('/barangays/validate-code')
        .send({ code: 'ABC123' })
        .expect(201);
    await request(app.getHttpServer())
      .post('/barangays/validate-code')
      .send({ code: 'ABC123' })
      .expect(429);
  });
});
