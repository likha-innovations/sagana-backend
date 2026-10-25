import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: { getOperators: jest.Mock };

  beforeEach(async () => {
    usersService = {
      getOperators: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getOperators', () => {
    it('should call usersService.getOperators', async () => {
      const mockOperators = [{ id: 'user_1', role: 'operator' }];
      usersService.getOperators.mockResolvedValue(mockOperators);

      const result = await controller.getOperators();
      expect(result).toEqual(mockOperators);
      expect(usersService.getOperators).toHaveBeenCalled();
    });
  });
});
