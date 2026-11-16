import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import type { RequestUser } from '../types/auth.types';

describe('AdminGuard', () => {
  let guard: AdminGuard;

  const createMockContext = (user?: Partial<RequestUser>): ExecutionContext => {
    const request = { user };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    guard = new AdminGuard();
  });

  it('allows access when user has admin role in request context', () => {
    const context = createMockContext({
      id: 'admin_1',
      role: 'admin',
      barangayId: 'brgy_1',
      status: 'active',
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when user has operator role', () => {
    const context = createMockContext({
      id: 'op_1',
      role: 'operator',
      barangayId: 'brgy_1',
      status: 'active',
    });

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('Admin access required'),
    );
  });

  it('throws ForbiddenException when request.user is missing', () => {
    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('Admin access required'),
    );
  });

  it('throws ForbiddenException when role is unassigned or not admin', () => {
    const context = createMockContext({
      id: 'unassigned_1',
      role: '',
      barangayId: null,
      status: 'unindexed',
    });

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('Admin access required'),
    );
  });
});
