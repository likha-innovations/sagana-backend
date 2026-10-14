import { z } from 'zod/v4';
import { createZodDto } from 'nestjs-zod';

export const RegisterMachineSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  mac_address: z
    .string()
    .min(1, 'Device identifier is required')
    .regex(
      /^(([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/,
      'Invalid MAC address or device identifier format',
    ),
  wifi_ssid: z.string().min(1, 'WiFi SSID is required'),
});

export class RegisterMachineDto extends createZodDto(RegisterMachineSchema) {}
