import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { assertAdminUser } from './clerk';
import type { AuthenticatedRequest } from './clerk-auth.guard';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(
    @InjectPinoLogger(AdminRoleGuard.name)
    private readonly logger: PinoLogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.auth?.userId;
    const path = request.path;
    const method = request.method;

    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    try {
      await assertAdminUser(userId);
      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) {
        this.logger.warn(
          { event: 'admin.forbidden', path, method, userId },
          'User is not an admin',
        );
      }
      throw err;
    }
  }
}
