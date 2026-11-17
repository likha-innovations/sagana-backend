import { z } from 'zod/v4';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().startsWith('sk_'),
  CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(['development', 'test', 'staging', 'production'])
    .default('development'),
  ENABLE_DEV_AUTH_BYPASS: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((val) => val === true || val === 'true')
    .default(false),

  // MQTT Broker (HiveMQ)
  MQTT_HOST: z.string().default('localhost'),
  MQTT_PORT: z.coerce.number().default(8883),
  MQTT_PROTOCOL: z.enum(['mqtt', 'mqtts', 'ws', 'wss']).default('mqtts'),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_CLIENT_ID: z.string().default('sagana_backend'),
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
