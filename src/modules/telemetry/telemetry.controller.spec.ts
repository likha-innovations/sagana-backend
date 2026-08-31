import { Test, TestingModule } from '@nestjs/testing';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

describe('TelemetryController', () => {
  let controller: TelemetryController;
  let service: any;

  beforeEach(async () => {
    service = {
      sendCommandToDevice: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelemetryController],
      providers: [
        {
          provide: TelemetryService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<TelemetryController>(TelemetryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should send command to device', async () => {
    const command = { action: 'restart' };
    const result = await controller.sendCommand('dev-01', command);
    expect(service.sendCommandToDevice).toHaveBeenCalledWith('dev-01', command);
    expect(result).toEqual({ success: true });
  });
});
