import { createZodDto } from 'nestjs-zod';
import { z } from 'zod/v4';

export const CreateBatchSchema = z
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

export class CreateBatchDto extends createZodDto(CreateBatchSchema) {}
