import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Request } from 'express';

export type AuthenticatedRequest = Request & {
  auth: {
    userId: string;
  };
};

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly secretKey = process.env.CLERK_SECRET_KEY;

  constructor(
    @InjectPinoLogger(ClerkAuthGuard.name)
    private readonly logger: PinoLogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;
    const method = request.method;

    if (!this.secretKey) {
      this.logger.error(
        { event: 'auth.config_missing', path, method },
        'CLERK_SECRET_KEY is not configured',
      );
      throw new UnauthorizedException('CLERK_SECRET_KEY is not configured');
    }

    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      this.logger.warn({ event: 'auth.missing_bearer', path, method }, 'Missing Bearer token');
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = authorization.slice('Bearer '.length);

    try {
      const payload = await verifyToken(token, {
        secretKey: this.secretKey,
      });

      if (!payload.sub) {
        this.logger.warn(
          { event: 'auth.invalid_token', path, method, reason: 'missing_sub' },
          'Invalid session token',
        );
        throw new UnauthorizedException('Invalid session token');
      }

      (request as AuthenticatedRequest).auth = { userId: payload.sub };
      this.logger.debug(
        { event: 'auth.success', path, method, userId: payload.sub },
        'Authenticated request',
      );
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.warn(
        {
          event: 'auth.token_verification_failed',
          path,
          method,
          err,
        },
        'Invalid or expired session token',
      );
      throw new UnauthorizedException('Invalid or expired session token');
    }
  }
}
