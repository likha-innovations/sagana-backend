import { UsersOperatorController } from './users-operator.controller';
import { UsersService } from './users.service';

describe('UsersOperatorController', () => {
  const service = { getProfile: jest.fn(), updateProfile: jest.fn() };
  const controller = new UsersOperatorController(
    service as unknown as UsersService,
  );

  it('forwards the authenticated user to profile reads and updates without barangayId', async () => {
    await controller.getProfile('user-1');
    await controller.updateProfile('user-1', {
      firstName: 'Juan',
    });
    expect(service.getProfile).toHaveBeenCalledWith('user-1');
    expect(service.updateProfile).toHaveBeenCalledWith('user-1', {
      firstName: 'Juan',
    });
    expect(service.updateProfile).not.toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ barangayId: expect.anything() }),
    );
  });
});
