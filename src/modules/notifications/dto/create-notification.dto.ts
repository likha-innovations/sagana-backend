import { createZodDto } from 'nestjs-zod';
import { z } from 'zod/v4';

export const CreateNotificationSchema = z.object({
  type: z
    .enum(['automation', 'batch', 'sensor', 'system', 'machine'])
    .default('system'),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(1000),
  machineId: z.string().optional(),
  batchId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export class CreateNotificationDto extends createZodDto(
  CreateNotificationSchema,
) {}
