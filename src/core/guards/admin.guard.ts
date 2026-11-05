import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { id: string } }>();
    const user = request.user?.id
      ? await this.prisma.user.findUnique({
          where: { id: request.user.id },
          select: { role: true },
        })
      : null;
    if (user?.role !== 'admin')
      throw new ForbiddenException('Admin access required');
    return true;
  }
}
