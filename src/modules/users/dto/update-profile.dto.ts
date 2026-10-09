import { createZodDto } from 'nestjs-zod';
import { z } from 'zod/v4';

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
});

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
