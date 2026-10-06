import { createZodDto } from 'nestjs-zod';
import { z } from 'zod/v4';

const updateProfileSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  birthday: z.string().optional(),
  barangayId: z.string().optional(),
});

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
