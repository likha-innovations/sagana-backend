import { validate } from './env.validation';

describe('env.validation', () => {
  const baseConfig = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    CLERK_SECRET_KEY: 'sk_test_123',
    CLERK_PUBLISHABLE_KEY: 'pk_test_123',
  };

  it('validates config and applies default values for NODE_ENV and ENABLE_DEV_AUTH_BYPASS', () => {
    const parsed = validate(baseConfig);
    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.ENABLE_DEV_AUTH_BYPASS).toBe(false);
  });

  it('parses valid NODE_ENV and parses ENABLE_DEV_AUTH_BYPASS boolean transform', () => {
    const parsed = validate({
      ...baseConfig,
      NODE_ENV: 'production',
      ENABLE_DEV_AUTH_BYPASS: 'true',
    });
    expect(parsed.NODE_ENV).toBe('production');
    expect(parsed.ENABLE_DEV_AUTH_BYPASS).toBe(true);
  });
});
