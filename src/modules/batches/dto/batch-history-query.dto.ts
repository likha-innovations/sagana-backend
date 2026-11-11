import { createZodDto } from 'nestjs-zod';
import { z } from 'zod/v4';

export const BatchHistoryQuerySchema = z
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

export class BatchHistoryQueryDto extends createZodDto(
  BatchHistoryQuerySchema,
) {}
