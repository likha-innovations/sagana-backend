import { createZodDto } from 'nestjs-zod';
import { z } from 'zod/v4';

export const NotificationQuerySchema = z.object({
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((val) => val === true || val === 'true')
    .optional(),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export class NotificationQueryDto extends createZodDto(
  NotificationQuerySchema,
) {}
