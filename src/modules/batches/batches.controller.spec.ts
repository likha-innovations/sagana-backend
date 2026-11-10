import { BadRequestException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';

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
  const pipeFor = (method: keyof BatchesController) => {
    const args = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      BatchesController,
      method,
    ) as Record<string, { pipes: unknown[] }>;
    const pipe = Object.values(args)
      .flatMap((arg) => arg.pipes)
      .find((item) => item instanceof ZodValidationPipe);
    if (!(pipe instanceof ZodValidationPipe))
      throw new Error(`Missing validation pipe for ${method}`);
    return pipe;
  };

  beforeEach(() => jest.resetAllMocks());

  it('passes the authenticated user and batch data to the service', async () => {
    const input = {
      machineId: 'machine',
      feedstocks: [{ id: 'feedstock', weight: 2 }],
    };
    await controller.list('user');
    await controller.get('user', 'batch');
    await controller.create('user', input);
    await controller.finish('user', 'batch', { outputWeight: 1 });
    expect(service.list).toHaveBeenCalledWith('user');
    expect(service.get).toHaveBeenCalledWith('user', 'batch');
    expect(service.create).toHaveBeenCalledWith('user', input);
    expect(service.finish).toHaveBeenCalledWith('user', 'batch', 1);
  });

  it('rejects invalid batch creation and finish bodies', () => {
    const create = pipeFor('create');
    const finish = pipeFor('finish');
    expect(() => create.transform({ machineId: 'm', feedstocks: [] })).toThrow(
      BadRequestException,
    );
    expect(() =>
      create.transform({
        machineId: 'm',
        feedstocks: [
          { id: 'f', weight: 1 },
          { id: 'f', weight: 2 },
        ],
      }),
    ).toThrow(BadRequestException);
    expect(() => finish.transform({ outputWeight: -1 })).toThrow(
      BadRequestException,
    );
    expect(finish.transform({})).toEqual({});
  });

  it('validates and forwards scoped history queries', async () => {
    const pipe = pipeFor('machineReadings');
    const query = pipe.transform({ limit: '50', offset: '2' }) as {
      limit: number;
      offset: number;
    };
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
    expect(() => pipe.transform({ limit: '2001' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      pipe.transform({
        startDate: '2026-01-02T00:00:00Z',
        endDate: '2026-01-01T00:00:00Z',
      }),
    ).toThrow(BadRequestException);
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
