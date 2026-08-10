import { z } from 'zod/v4';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().startsWith('sk_'),
  CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  PORT: z.coerce.number().default(3000),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const formatted = z.prettifyError(result.error);
    console.error('❌ Environment validation failed:\n', formatted);
    process.exit(1);
  }

  return result.data;
}
