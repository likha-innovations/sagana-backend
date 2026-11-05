import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ThrottlerModule } from '@nestjs/throttler';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppController } from './app.controller';
import { AdminGuard } from './core/guards/admin.guard';
import { PrismaService } from './infrastructure/database/prisma.service';
import { BarangaysController } from './modules/barangays/barangays.controller';
import { BarangaysService } from './modules/barangays/barangays.service';
import { BatchesController } from './modules/batches/batches.controller';
import { BatchesService } from './modules/batches/batches.service';
import { FeedstocksController } from './modules/feedstocks/feedstocks.controller';
import { FeedstocksService } from './modules/feedstocks/feedstocks.service';
import { MachinesController } from './modules/machines/machines.controller';
import { MachinesService } from './modules/machines/machines.service';
import { TelemetryController } from './modules/telemetry/telemetry.controller';
import { TelemetryService } from './modules/telemetry/telemetry.service';
import { UsersAdminController } from './modules/users/users-admin.controller';
import { UsersOperatorController } from './modules/users/users-operator.controller';
import { UsersService } from './modules/users/users.service';

describe('Swagger documentation', () => {
  it('groups each route once and documents its access and response', async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
      controllers: [
        AppController,
        BarangaysController,
        BatchesController,
        FeedstocksController,
        MachinesController,
        TelemetryController,
        UsersAdminController,
        UsersOperatorController,
      ],
      providers: [
        BarangaysService,
        BatchesService,
        FeedstocksService,
        MachinesService,
        TelemetryService,
        UsersService,
        AdminGuard,
        PrismaService,
      ].map((provide) => ({ provide, useValue: {} })),
    }).compile();
    const app = module.createNestApplication();
    const document = cleanupOpenApiDoc(
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder().addBearerAuth().build(),
      ),
    );
    const expected = [
      ['get', '/', 'System', 'Public'],
      ['get', '/health', 'System', 'Public'],
      ['get', '/me', 'Profile', 'Shared'],
      ['patch', '/me', 'Profile', 'Shared'],
      ['post', '/me/barangay-code', 'Profile', 'Shared'],
      ['get', '/barangays', 'Barangays', 'Public'],
      ['post', '/barangays/validate-code', 'Barangays', 'Public'],
      ['get', '/barangays/admin/code', 'Barangays', 'Admin'],
      ['post', '/barangays/admin/code/rotate', 'Barangays', 'Admin'],
      ['get', '/machines', 'Machines', 'Shared'],
      ['get', '/machines/{id}', 'Machines', 'Shared'],
      ['patch', '/machines/{id}', 'Machines', 'Shared'],
      ['delete', '/machines/{id}', 'Machines', 'Shared'],
      ['post', '/machines/register', 'Machines', 'Shared'],
      ['get', '/admin/operators', 'Users', 'Admin'],
      ['get', '/batches', 'Batches', 'Shared'],
      ['post', '/batches', 'Batches', 'Shared'],
      ['get', '/batches/{id}', 'Batches', 'Shared'],
      ['post', '/batches/{id}/finish', 'Batches', 'Shared'],
      ['get', '/batches/{id}/readings', 'Batches', 'Shared'],
      ['get', '/machines/{id}/readings', 'Batches', 'Shared'],
      ['get', '/feedstocks', 'Feedstocks', 'Public'],
      ['post', '/telemetry/devices/{deviceId}/command', 'Telemetry', 'Shared'],
    ] as const;
    expect(
      Object.values(document.paths).reduce(
        (count, path) => count + Object.keys(path).length,
        0,
      ),
    ).toBe(expected.length);
    for (const [method, path, group, access] of expected) {
      const operation = document.paths[path]?.[method];
      expect(operation).toBeDefined();
      expect(operation?.tags).toEqual([group]);
      expect(operation?.summary).toMatch(new RegExp(`^\\[${access}\\]`));
      if (access === 'Public') expect(operation?.security).toBeUndefined();
      else expect(operation?.security).toEqual([{ bearer: [] }]);
      const response = operation?.responses[method === 'post' ? '201' : '200'];
      expect(response).toHaveProperty(
        'content.application/json.example.success',
        true,
      );
      expect(operation?.responses['500']).toHaveProperty(
        'content.application/json.example.success',
        false,
      );
      if (access !== 'Public')
        expect(operation?.responses['401']).toHaveProperty(
          'content.application/json.example.success',
          false,
        );
    }
    for (const [method, path] of [
      ['patch', '/me'],
      ['post', '/me/barangay-code'],
      ['post', '/barangays/validate-code'],
      ['patch', '/machines/{id}'],
      ['post', '/machines/register'],
      ['post', '/batches'],
      ['post', '/batches/{id}/finish'],
      ['post', '/telemetry/devices/{deviceId}/command'],
    ] as const) {
      expect(document.paths[path][method]?.requestBody).toBeDefined();
      expect(document.paths[path][method]?.requestBody).toHaveProperty(
        'content.application/json.schema',
      );
    }
    await app.close();
  });
});
