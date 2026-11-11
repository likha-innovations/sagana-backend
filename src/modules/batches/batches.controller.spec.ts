import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';
import { CreateBatchSchema } from './dto/create-batch.dto';
import { FinishBatchSchema } from './dto/finish-batch.dto';
import { BatchHistoryQuerySchema } from './dto/batch-history-query.dto';

describe('BatchesController', () => {
  const service = {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    finish: jest.fn(),
    history: jest.fn(),
  };
  const controller = new BatchesController(
    service as unknown as BatchesService,
  );

  beforeEach(() => jest.resetAllMocks());

  it('passes the authenticated user and batch data to the service', async () => {
    const input = {
      machineId: 'machine',
      feedstocks: [{ id: 'feedstock', weight: 2 }],
    };
    await controller.list('user');
    await controller.get('user', 'batch');
    await controller.create('user', input);
    await controller.finish('user', 'batch', { finalWeight: 14.2 });
    await controller.finish('user', 'batch', { outputWeight: 10 });
    await controller.finish('user', 'batch', {});
    expect(service.list).toHaveBeenCalledWith('user');
    expect(service.get).toHaveBeenCalledWith('user', 'batch');
    expect(service.create).toHaveBeenCalledWith('user', input);
    expect(service.finish).toHaveBeenNthCalledWith(1, 'user', 'batch', 14.2);
    expect(service.finish).toHaveBeenNthCalledWith(2, 'user', 'batch', 10);
    expect(service.finish).toHaveBeenNthCalledWith(
      3,
      'user',
      'batch',
      undefined,
    );
  });

  it('rejects invalid batch creation and finish bodies', () => {
    expect(
      CreateBatchSchema.safeParse({ machineId: 'm', feedstocks: [] }).success,
    ).toBe(false);
    expect(
      CreateBatchSchema.safeParse({
        machineId: 'm',
        feedstocks: [
          { id: 'f', weight: 1 },
          { id: 'f', weight: 2 },
        ],
      }).success,
    ).toBe(false);
    expect(FinishBatchSchema.safeParse({ finalWeight: -1 }).success).toBe(
      false,
    );
    expect(FinishBatchSchema.safeParse({ outputWeight: -1 }).success).toBe(
      false,
    );
    expect(FinishBatchSchema.parse({ finalWeight: 14.2 })).toEqual({
      finalWeight: 14.2,
    });
    expect(FinishBatchSchema.parse({ outputWeight: 14.2 })).toEqual({
      outputWeight: 14.2,
    });
    expect(FinishBatchSchema.parse({})).toEqual({});
  });

  it('validates and forwards scoped history queries', async () => {
    const query = BatchHistoryQuerySchema.parse({ limit: '50', offset: '2' });
    await controller.machineReadings('user', 'machine', query);
    await controller.batchReadings('user', 'batch', query);
    expect(service.history).toHaveBeenNthCalledWith(
      1,
      'user',
      { machineId: 'machine' },
      query,
    );
    expect(service.history).toHaveBeenNthCalledWith(
      2,
      'user',
      { batchId: 'batch' },
      query,
    );
    expect(BatchHistoryQuerySchema.safeParse({ limit: '2001' }).success).toBe(
      false,
    );
    expect(
      BatchHistoryQuerySchema.safeParse({
        startDate: '2026-01-02T00:00:00Z',
        endDate: '2026-01-01T00:00:00Z',
      }).success,
    ).toBe(false);
  });

  it.each([
    'list',
    'get',
    'create',
    'finish',
    'machineReadings',
    'batchReadings',
  ] as const)('documents the %s operation in Swagger', (method) => {
    expect(
      Reflect.getMetadata(
        'swagger/apiOperation',
        Object.getOwnPropertyDescriptor(BatchesController.prototype, method)
          ?.value as object,
      ),
    ).toEqual(expect.objectContaining({ summary: expect.any(String) }));
  });

  it('publishes request, response, and pagination details in OpenAPI', async () => {
    const module = await Test.createTestingModule({
      controllers: [BatchesController],
      providers: [{ provide: BatchesService, useValue: service }],
    }).compile();
    const app = module.createNestApplication();
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const create = document.paths['/batches']?.post;
    const history = document.paths['/batches/{id}/readings']?.get;
    expect(create!.requestBody).toBeDefined();
    expect(create!.responses['409']).toBeDefined();
    expect(history!.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'startDate', in: 'query' }),
        expect.objectContaining({ name: 'limit', in: 'query' }),
      ]),
    );
    expect(history!.responses['200']).toHaveProperty(
      'content.application/json.example.data.readings',
    );
    await app.close();
  });
});
