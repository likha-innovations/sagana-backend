import { z } from 'zod/v4';
import { createZodDto } from 'nestjs-zod';

export const UpdateMachineSchema = z
  .object({
    name: z.string().min(1, 'Name is required').optional(),
    wifi_ssid: z.string().min(1, 'WiFi SSID is required').optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.wifi_ssid !== undefined,
    'At least one field (name or wifi_ssid) must be provided',
  );

export class UpdateMachineDto extends createZodDto(UpdateMachineSchema) {}
