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
  batchCode: 'BATCH-123',
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
  compostOutput: {
    id: 'output123',
    batchId: 'batch123',
    outputWeight: 14.2,
    productionDate: '2026-10-10T00:00:00.000Z',
    collectionDate: null,
    status: 'ready_for_collection',
  },
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
@ApiBearerAuth()
@Controller()
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Get('batches')
  @ApiOperation({
    summary: 'List batches for machines in the current user’s barangay',
    description:
      'Returns feedstocks, phases, and any compost output. A completion date takes precedence over the stored status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Batch list, or an empty array if no barangay is assigned.',
    content: { 'application/json': { example: response([batchExample]) } },
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({ status: 404, description: 'User profile not found.' })
  list(@CurrentUserId() userId: string) {
    return this.batches.list(userId);
  }

  @Get('batches/:id')
  @ApiOperation({ summary: 'Get an accessible batch and its recorded details' })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  @ApiResponse({
    status: 200,
    description:
      'Batch with machine name, feedstocks, phases, and optional output.',
    content: { 'application/json': { example: response(batchExample) } },
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({
    status: 404,
    description: 'User or accessible batch not found.',
  })
  get(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.batches.get(userId, id);
  }

  @Post('batches')
  @ApiOperation({
    summary: 'Start a compost batch',
    description:
      'Creates a batch and its feedstocks together. The machine must belong to the user’s barangay and cannot already have an active batch.',
  })
  @ApiBody({
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
      'Batch created with active status and no completion date or output.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid, duplicate, or inactive feedstocks, or invalid weights.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({
    status: 404,
    description: 'User or accessible machine not found.',
  })
  @ApiResponse({
    status: 409,
    description: 'The machine already has an active batch.',
  })
  create(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(createSchema))
    body: z.infer<typeof createSchema>,
  ) {
    return this.batches.create(userId, body);
  }

  @Post('batches/:id/finish')
  @ApiOperation({
    summary: 'Finish an active batch',
    description:
      'Records completion. An output record is created only when a measured output weight is supplied.',
  })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        outputWeight: {
          type: 'number',
          minimum: 0,
          description: 'Optional measured compost output in kilograms.',
        },
      },
    },
    examples: {
      withoutWeight: { summary: 'Finish without output weight', value: {} },
      withWeight: {
        summary: 'Finish with output weight',
        value: { outputWeight: 14.2 },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Batch finished.',
    content: { 'application/json': { example: response(batchExample) } },
  })
  @ApiResponse({ status: 400, description: 'Invalid output weight.' })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({
    status: 404,
    description: 'User or accessible batch not found.',
  })
  @ApiResponse({
    status: 409,
    description: 'The batch is not active or has already been completed.',
  })
  finish(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(finishSchema))
    body: z.infer<typeof finishSchema>,
  ) {
    return this.batches.finish(userId, id, body.outputWeight);
  }

  @Get('machines/:id/readings')
  @ApiOperation({
    summary: 'Get recorded sensor history for a machine',
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
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid date range or pagination.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({
    status: 404,
    description: 'User or accessible machine not found.',
  })
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
    summary: 'Get sensor history for a batch',
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
  @ApiResponse({
    status: 400,
    description: 'Invalid date range or pagination.',
  })
  @ApiResponse({ status: 401, description: 'Authentication required.' })
  @ApiResponse({
    status: 404,
    description: 'User or accessible batch or machine not found.',
  })
  batchReadings(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(historySchema))
    query: z.infer<typeof historySchema>,
  ) {
    return this.batches.history(userId, { batchId: id }, query);
  }
}
