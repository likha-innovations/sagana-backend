import { createZodDto } from 'nestjs-zod';
import { z } from 'zod/v4';

const telemetryQuerySchema = z.object({
  batchId: z.string().optional(),
  sensorId: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(50),
});

export class TelemetryQueryDto extends createZodDto(telemetryQuerySchema) {}
