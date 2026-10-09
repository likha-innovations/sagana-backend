import { z } from 'zod/v4';

export const RegisterMachineSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  mac_address: z
    .string()
    .regex(
      /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/,
      'Invalid MAC address format (expected AA:BB:CC:DD:EE:FF)',
    ),
  wifi_ssid: z.string().min(1, 'WiFi SSID is required'),
});

export type RegisterMachineDto = z.infer<typeof RegisterMachineSchema>;
