import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { verifyToken } from '@clerk/backend';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UsersService } from '../../modules/users/users.service';
import type { RequestUser } from '../types/auth.types';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    @Optional() private readonly usersService?: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token missing');
    }

    // ponytail: in development with explicit opt-in flag, allow non-expiring dev token for zero-latency testing
    const isDevAuthAllowed =
      process.env.NODE_ENV === 'development' &&
      process.env.ENABLE_DEV_AUTH_BYPASS === 'true';

    if (isDevAuthAllowed && token.startsWith('dev_')) {
      const devIdentifier = token.replace(/^dev_/, '');
      let devUser: RequestUser | null = null;
      if (this.prisma?.user?.findFirst) {
        devUser = await this.prisma.user.findFirst({
          where:
            devIdentifier === 'operator' || devIdentifier === 'admin'
              ? { role: devIdentifier }
              : { OR: [{ id: devIdentifier }, { email: devIdentifier }] },
          select: { id: true, role: true, barangayId: true, status: true },
        });
        if (!devUser) {
          devUser = await this.prisma.user.findFirst({
            select: { id: true, role: true, barangayId: true, status: true },
          });
        }
      }

      request.user = {
        id: devUser?.id ?? 'dev_user_1',
        role: devUser?.role ?? 'operator',
        barangayId: devUser?.barangayId ?? null,
        status: devUser?.status ?? 'active',
      };
      return true;
    }

    let payload: { sub: string };
    try {
      payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const userId = payload.sub;
    let user: RequestUser | null = null;

    if (this.prisma?.user?.findUnique) {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, barangayId: true, status: true },
      });
    }

    if (!user && this.usersService) {
      try {
        const profile = await this.usersService.getProfile(userId);
        user = {
          id: profile.id,
          role: profile.role,
          barangayId: profile.barangayId,
          status: profile.status,
        };
      } catch {
        user = null;
      }
    }

    request.user = {
      id: user?.id ?? userId,
      role: user?.role ?? 'operator',
      barangayId: user?.barangayId ?? null,
      status: user?.status ?? (user ? 'active' : 'unindexed'),
    };
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
