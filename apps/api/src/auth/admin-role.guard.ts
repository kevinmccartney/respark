import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { createClerkClient } from '@clerk/backend'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import type { AuthenticatedRequest } from './clerk-auth.guard'

@Injectable()
export class AdminRoleGuard implements CanActivate {
  private readonly secretKey = process.env.CLERK_SECRET_KEY

  constructor(
    @InjectPinoLogger(AdminRoleGuard.name)
    private readonly logger: PinoLogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const userId = request.auth?.userId
    const path = request.path
    const method = request.method

    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user')
    }

    if (!this.secretKey) {
      this.logger.error(
        { event: 'admin.config_missing', path, method },
        'CLERK_SECRET_KEY is not configured',
      )
      throw new UnauthorizedException('CLERK_SECRET_KEY is not configured')
    }

    const clerk = createClerkClient({ secretKey: this.secretKey })
    const user = await clerk.users.getUser(userId)
    const role = user.publicMetadata?.role

    if (role !== 'admin') {
      this.logger.warn(
        { event: 'admin.forbidden', path, method, userId },
        'User is not an admin',
      )
      throw new ForbiddenException('Admin role required')
    }

    return true
  }
}
