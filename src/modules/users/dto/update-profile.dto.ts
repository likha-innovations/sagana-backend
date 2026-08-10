import { createZodDto } from 'nestjs-zod';
import { z } from 'zod/v4';

const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  contactNumber: z.string().min(5).optional(),
  location: z.string().min(2).optional(),
});

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
