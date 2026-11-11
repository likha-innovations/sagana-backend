import { createZodDto } from 'nestjs-zod';
import { z } from 'zod/v4';

export const FinishBatchSchema = z.object({
  finalWeight: z.number().finite().nonnegative().optional(),
  outputWeight: z.number().finite().nonnegative().optional(),
});

export class FinishBatchDto extends createZodDto(FinishBatchSchema) {}
