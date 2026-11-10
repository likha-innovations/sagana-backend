import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUserId } from '../../core/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../core/pipes/zod-validation.pipe';
import { BatchesService } from './batches.service';
import { ApiErrorExample } from '../../core/swagger/examples';

const createSchema = z
  .object({
    machineId: z.string().min(1),
    feedstocks: z
      .array(
        z.object({
          id: z.string().min(1),
          weight: z.number().finite().positive(),
        }),
      )
      .min(1),
  })
  .refine(
    (value) =>
      new Set(value.feedstocks.map((item) => item.id)).size ===
      value.feedstocks.length,
    'Duplicate feedstocks',
  );
const finishSchema = z.object({
  finalWeight: z.number().finite().nonnegative().optional(),
  outputWeight: z.number().finite().nonnegative().optional(),
});
const historySchema = z
  .object({
    startDate: z.iso.datetime().optional(),
    endDate: z.iso.datetime().optional(),
    offset: z.coerce.number().int().min(0).max(100000).default(0),
    limit: z.coerce.number().int().min(1).max(2000).default(200),
  })
  .refine(
    (value) =>
      !value.startDate || !value.endDate || value.startDate <= value.endDate,
    'Invalid date range',
  );

const batchExample = {
  id: 'batch123',
  machineId: 'machine123',
  userId: 'user123',
  batchCode: 'BATCH-123e4567-e89b-42d3-a456-426614174000',
  status: 'completed',
  startDate: '2026-10-01T00:00:00.000Z',
  completionDate: '2026-10-10T00:00:00.000Z',
  totalWeight: 20,
  machineName: 'Sagana 1',
  finalWeight: 14.2,
  feedstocks: [
    {
      id: 'item123',
      feedstockId: 'feedstock123',
      name: 'Dry Leaves',
      category: 'brown',
      weightKg: 20,
    },
  ],
  compostingPhases: [],
};
const historyExample = {
  sensors: [
    {
      id: 'sensor123',
      machineId: 'machine123',
      sensorType: 'temperature',
      location: 'core',
      unit: '°C',
      status: 'active',
    },
  ],
  readings: [
    {
      id: 'reading:sample123',
      machineId: 'machine123',
      batchId: 'batch123',
      recordedAt: '2026-10-05T08:30:00.000Z',
      temperature: 42.1,
      moisture: null,
      oxygen: null,
      co2: null,
    },
  ],
  hasMore: false,
};
const response = (data: unknown) => ({
  success: true,
  data,
  timestamp: '2026-10-10T00:00:00.000Z',
});

@ApiTags('Batches')
@ApiErrorExample(500, 'Unexpected server error.', 'Internal server error')
@ApiBearerAuth()
@Controller()
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Get('batches')
  @ApiOperation({
    summary: '[Shared] List batches',
    description:
      'Returns feedstocks and phases. A completion date takes precedence over the stored status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Batch list, or an empty array if no barangay is assigned.',
    content: { 'application/json': { example: response([batchExample]) } },
  })
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @ApiErrorExample(
    404,
    'User profile not found.',
    'Authenticated user not found',
  )
  list(@CurrentUserId() userId: string) {
    return this.batches.list(userId);
  }

  @Get('batches/:id')
  @ApiOperation({
    summary: '[Shared] Get a batch',
    description:
      'Returns a batch for a non-removed machine in the user’s barangay.',
  })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  @ApiResponse({
    status: 200,
    description: 'Batch with machine name, feedstocks, and phases.',
    content: { 'application/json': { example: response(batchExample) } },
  })
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @ApiErrorExample(
    404,
    'User or accessible batch not found.',
    'Batch not found',
  )
  get(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.batches.get(userId, id);
  }

  @Post('batches')
  @ApiOperation({
    summary: '[Shared] Start a batch',
    description:
      'Creates a batch and its feedstocks together. The machine must belong to the user’s barangay and cannot already have an active batch.',
  })
  @ApiBody({
    examples: {
      create: {
        value: {
          machineId: 'machine123',
          feedstocks: [{ id: 'feedstock123', weight: 20 }],
        },
      },
    },
    schema: {
      type: 'object',
      required: ['machineId', 'feedstocks'],
      properties: {
        machineId: { type: 'string', example: 'machine123' },
        feedstocks: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['id', 'weight'],
            properties: {
              id: { type: 'string', example: 'feedstock123' },
              weight: {
                type: 'number',
                minimum: 0,
                exclusiveMinimum: true,
                description: 'Weight in kilograms.',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description:
      'Batch created with active status and no completion date or final weight.',
    content: {
      'application/json': {
        example: response({
          ...batchExample,
          status: 'active',
          completionDate: null,
          finalWeight: null,
        }),
      },
    },
  })
  @ApiErrorExample(
    400,
    'Invalid, duplicate, or inactive feedstocks, or invalid weights.',
    'Invalid or inactive feedstock',
  )
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @ApiErrorExample(
    404,
    'User or accessible machine not found.',
    'Machine not found',
  )
  @ApiErrorExample(
    409,
    'The machine already has an active batch.',
    'Machine already has an active batch',
  )
  create(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(createSchema))
    body: z.infer<typeof createSchema>,
  ) {
    return this.batches.create(userId, body);
  }

  @Post('batches/:id/finish')
  @ApiOperation({
    summary: '[Shared] Finish a batch',
    description: 'Records completion and stores measured final output weight.',
  })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        finalWeight: {
          type: 'number',
          minimum: 0,
          description: 'Optional measured final compost weight in kilograms.',
        },
        outputWeight: {
          type: 'number',
          minimum: 0,
          description: 'Backwards-compatible alias for finalWeight.',
        },
      },
    },
    examples: {
      withoutWeight: { summary: 'Finish without final weight', value: {} },
      withFinalWeight: {
        summary: 'Finish with final weight',
        value: { finalWeight: 14.2 },
      },
      withOutputWeight: {
        summary: 'Finish with output weight (legacy alias)',
        value: { outputWeight: 14.2 },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Batch finished.',
    content: { 'application/json': { example: response(batchExample) } },
  })
  @ApiErrorExample(
    400,
    'Invalid output weight.',
    'Too small: expected number to be >=0',
  )
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @ApiErrorExample(
    404,
    'User or accessible batch not found.',
    'Batch not found',
  )
  @ApiErrorExample(
    409,
    'The batch is not active or has already been completed.',
    'Batch is not active',
  )
  finish(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(finishSchema))
    body: z.infer<typeof finishSchema>,
  ) {
    const finalWeight = body.finalWeight ?? body.outputWeight;
    return this.batches.finish(userId, id, finalWeight);
  }

  @Get('machines/:id/readings')
  @ApiOperation({
    summary: '[Shared] Get machine sensor history',
    description:
      'Returns sensor metadata and recorded sensor readings, ordered newest first.',
  })
  @ApiParam({ name: 'id', description: 'Machine ID' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Inclusive ISO 8601 UTC timestamp.',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Inclusive ISO 8601 UTC timestamp.',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Result offset, 0–100000; default 0.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size, 1–2000; default 200.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sensor metadata, readings, and hasMore pagination flag.',
    content: { 'application/json': { example: response(historyExample) } },
  })
  @ApiErrorExample(
    400,
    'Invalid date range or pagination.',
    'Invalid date range',
  )
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @ApiErrorExample(
    404,
    'User or accessible machine not found.',
    'Machine not found',
  )
  machineReadings(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(historySchema))
    query: z.infer<typeof historySchema>,
  ) {
    return this.batches.history(userId, { machineId: id }, query);
  }

  @Get('batches/:id/readings')
  @ApiOperation({
    summary: '[Shared] Get batch sensor history',
    description:
      'Returns recorded sensor readings explicitly linked to this batch.',
  })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Inclusive ISO 8601 UTC timestamp.',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Inclusive ISO 8601 UTC timestamp.',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Result offset, 0–100000; default 0.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size, 1–2000; default 200.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sensor metadata, readings, and hasMore pagination flag.',
    content: { 'application/json': { example: response(historyExample) } },
  })
  @ApiErrorExample(
    400,
    'Invalid date range or pagination.',
    'Invalid date range',
  )
  @ApiErrorExample(
    401,
    'Authentication required.',
    'Authentication token missing',
  )
  @ApiErrorExample(
    404,
    'User or accessible batch or machine not found.',
    'Batch not found',
  )
  batchReadings(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(historySchema))
    query: z.infer<typeof historySchema>,
  ) {
    return this.batches.history(userId, { batchId: id }, query);
  }
}
