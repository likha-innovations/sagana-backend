import { createZodDto } from 'nestjs-zod';
import { z } from 'zod/v4';

const publishCommandSchema = z.object({
  action: z.string().min(1, 'Action is required'),
  payload: z.record(z.string(), z.any()).optional(),
});

export class PublishCommandDto extends createZodDto(publishCommandSchema) {}
