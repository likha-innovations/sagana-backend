import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MqttService } from './mqtt.service';

jest.mock('mqtt', () => ({
  connect: jest.fn(() => ({
    on: jest.fn(),
    subscribe: jest.fn((topic, opts, cb) => cb && cb(null)),
    publish: jest.fn((topic, payload, opts, cb) => cb && cb(null)),
    end: jest.fn((force, cb) => cb && cb()),
    connected: true,
  })),
}));

describe('MqttService', () => {
  let service: MqttService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MqttService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const mockConfig: Record<string, any> = {
                MQTT_HOST: 'localhost',
                MQTT_PORT: 8883,
                MQTT_PROTOCOL: 'mqtts',
                MQTT_CLIENT_ID: 'test_client',
              };
              return mockConfig[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MqttService>(MqttService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should connect on module init', () => {
    service.onModuleInit();
    expect(service.getClient()).toBeDefined();
  });

  it('should allow registering a message handler', () => {
    const handler = jest.fn();
    service.onMessage(handler);
    expect(service['messageHandlers']).toContain(handler);
  });

  it('should publish a message when client is connected', async () => {
    service.onModuleInit();
    await expect(
      service.publish('sagana/devices/test/commands', { action: 'restart' }),
    ).resolves.toBeUndefined();
  });
});
