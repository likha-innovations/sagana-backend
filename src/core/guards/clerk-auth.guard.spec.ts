import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { verifyToken } from '@clerk/backend';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UsersService } from '../../modules/users/users.service';

jest.mock('@clerk/backend', () => ({
  verifyToken: jest.fn(),
}));

describe('ClerkAuthGuard', () => {
  let guard: ClerkAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let prisma: { user: { findUnique: jest.Mock } };
  let usersService: { getProfile: jest.Mock };

  const createMockContext = (
    headers: Record<string, string> = {},
  ): ExecutionContext => {
    const request = {
      headers,
      user: undefined,
    };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<Reflector>;
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };
    usersService = {
      getProfile: jest.fn(),
    };
    guard = new ClerkAuthGuard(
      reflector,
      prisma as unknown as PrismaService,
      usersService as unknown as UsersService,
    );
  });

  it('allows public routes without authentication', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = createMockContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when authorization header is missing', async () => {
    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Authentication token missing'),
    );
  });

  it('throws UnauthorizedException when token is invalid or expired', async () => {
    const context = createMockContext({ authorization: 'Bearer bad_token' });
    jest.mocked(verifyToken).mockRejectedValue(new Error('Invalid token'));

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Invalid or expired token'),
    );
  });

  it('hydrates request.user when token is valid and user is in database', async () => {
    const context = createMockContext({ authorization: 'Bearer valid_token' });
    const req = context.switchToHttp().getRequest();
    jest.mocked(verifyToken).mockResolvedValue({ sub: 'user_123' } as never);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user_123',
      role: 'admin',
      barangayId: 'brgy_1',
      status: 'active',
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(req.user).toEqual({
      id: 'user_123',
      role: 'admin',
      barangayId: 'brgy_1',
      status: 'active',
    });
  });

  it('triggers JIT sync when user is not yet in database', async () => {
    const context = createMockContext({ authorization: 'Bearer valid_token' });
    const req = context.switchToHttp().getRequest();
    jest.mocked(verifyToken).mockResolvedValue({ sub: 'user_new' } as never);
    prisma.user.findUnique.mockResolvedValue(null);
    usersService.getProfile.mockResolvedValue({
      id: 'user_new',
      role: 'operator',
      barangayId: 'brgy_2',
      status: 'active',
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(usersService.getProfile).toHaveBeenCalledWith('user_new');
    expect(req.user).toEqual({
      id: 'user_new',
      role: 'operator',
      barangayId: 'brgy_2',
      status: 'active',
    });
  });

  it('falls back to safe unindexed context when JIT sync fails', async () => {
    const context = createMockContext({ authorization: 'Bearer valid_token' });
    const req = context.switchToHttp().getRequest();
    jest
      .mocked(verifyToken)
      .mockResolvedValue({ sub: 'user_unindexed' } as never);
    prisma.user.findUnique.mockResolvedValue(null);
    usersService.getProfile.mockRejectedValue(
      new Error('Clerk API unavailable'),
    );

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(req.user).toEqual({
      id: 'user_unindexed',
      role: 'operator',
      barangayId: null,
      status: 'unindexed',
    });
  });
});
