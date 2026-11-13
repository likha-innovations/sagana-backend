import { z } from 'zod/v4';
import { createZodDto } from 'nestjs-zod';

export const UpdateMachineSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(30, 'Name must be 30 characters or fewer')
      .optional(),
    wifiSsid: z.string().min(1, 'WiFi SSID is required').optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.wifiSsid !== undefined,
    'At least one field (name or wifiSsid) must be provided',
  );

export class UpdateMachineDto extends createZodDto(UpdateMachineSchema) {}
