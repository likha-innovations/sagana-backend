import { z } from 'zod/v4';
import { createZodDto } from 'nestjs-zod';

export const UpdateOperatorStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
});

export class UpdateOperatorStatusDto extends createZodDto(
  UpdateOperatorStatusSchema,
) {}
