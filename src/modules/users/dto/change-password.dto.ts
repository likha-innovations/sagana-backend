import { createZodDto } from 'nestjs-zod';
import { z } from 'zod/v4';

const verifyOtpSchema = z.object({
  code: z.string().length(6, 'Verification code must be exactly 6 digits'),
});

export class VerifyOtpDto extends createZodDto(verifyOtpSchema) {}

const changePasswordSchema = z.object({
  code: z.string().length(6, 'Verification code must be exactly 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
