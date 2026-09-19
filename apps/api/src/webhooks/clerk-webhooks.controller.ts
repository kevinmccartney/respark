import {
  BadRequestException,
  Controller,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { verifyWebhook } from '@clerk/backend/webhooks';
import type { WebhookEvent } from '@clerk/backend/webhooks';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Request as ExpressRequest } from 'express';
import { UsersService } from '../users/users.service';

/** Narrowed from the event union so the payload type tracks the SDK version. */
type ClerkUser = Extract<WebhookEvent, { type: 'user.created' | 'user.updated' }>['data'];

/**
 * Public endpoint: Clerk authenticates with a Svix signature, not a bearer token,
 * so ClerkAuthGuard must not be applied here.
 */
@Controller('webhooks')
export class ClerkWebhooksController {
  constructor(
    private readonly users: UsersService,
    @InjectPinoLogger(ClerkWebhooksController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post('clerk')
  @HttpCode(200)
  async handleClerk(@Req() request: RawBodyRequest<ExpressRequest>) {
    if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
      this.logger.error(
        { event: 'webhook.config_missing' },
        'CLERK_WEBHOOK_SIGNING_SECRET is not configured',
      );
      // 503 so Svix retries once the secret is in place; a 400 would be dropped.
      throw new ServiceUnavailableException('Webhook signing secret is not configured');
    }

    const event = await this.verify(request);
    const svixId = request.headers['svix-id'];

    switch (event.type) {
      case 'user.created':
      case 'user.updated':
        await this.users.syncFromClerk(toProfile(event.data));
        break;

      case 'user.deleted':
        if (event.data.id) {
          await this.users.markDeleted(event.data.id);
        }
        break;

      default:
        this.logger.debug(
          { event: 'webhook.ignored', type: event.type, svixId },
          'Ignoring unhandled Clerk event',
        );
    }

    // Always 200 on a verified event; a non-2xx would make Svix retry work we did.
    return { received: true };
  }

  private async verify(request: RawBodyRequest<ExpressRequest>): Promise<WebhookEvent> {
    // Signature verification needs the exact bytes Clerk signed, so this relies on
    // `rawBody: true` in main.ts rather than the JSON-parsed body.
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw request body');
    }

    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(','));
    }

    try {
      return await verifyWebhook(
        new Request('https://respark.invalid/webhooks/clerk', {
          method: 'POST',
          headers,
          // Fetch BodyInit accepts Uint8Array, not Node's Buffer typing.
          body: new Uint8Array(rawBody),
        }),
      );
    } catch (err) {
      this.logger.warn({ event: 'webhook.verification_failed', err }, 'Rejected Clerk webhook');
      throw new BadRequestException('Webhook verification failed');
    }
  }
}

const toProfile = (data: ClerkUser) => {
  const primary =
    data.email_addresses?.find((address) => address.id === data.primary_email_address_id) ??
    data.email_addresses?.[0];

  return {
    clerkUserId: data.id,
    email: primary?.email_address ?? null,
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
    imageUrl: data.image_url ?? null,
    clerkUpdatedAt: data.updated_at ? new Date(data.updated_at) : null,
  };
};
