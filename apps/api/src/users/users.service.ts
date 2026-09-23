import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { eq, isNull, or, sql } from 'drizzle-orm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DATABASE, type Database } from '../db/database.module';
import { users } from '../db/schema';

/** Profile fields Clerk owns; mirrored locally by the user.* webhooks. */
export type ClerkUserProfile = {
  clerkUserId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  clerkUpdatedAt: Date | null;
};

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @InjectPinoLogger(UsersService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Resolves a Clerk user id to the local user id, creating the row on first use.
   * Webhooks are eventually consistent, so authenticated requests cannot assume
   * `user.created` has landed yet; this keeps the request path self-sufficient.
   */
  async resolveLocalId(clerkUserId: string): Promise<string> {
    const [user] = await this.db
      .insert(users)
      .values({ clerkUserId })
      .onConflictDoUpdate({ target: users.clerkUserId, set: { clerkUserId } })
      .returning({ id: users.id, deletedAt: users.deletedAt });

    if (user.deletedAt) {
      throw new ForbiddenException('Account is deleted');
    }

    return user.id;
  }

  /**
   * Upserts the Clerk-owned profile fields. Ignores events older than the last one
   * applied, so a delayed `user.updated` cannot overwrite newer data.
   */
  async syncFromClerk(profile: ClerkUserProfile): Promise<void> {
    const { clerkUserId, ...fields } = profile;

    const result = await this.db
      .insert(users)
      .values({ clerkUserId, ...fields, deletedAt: null })
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: { ...fields, deletedAt: null, updatedAt: new Date() },
        where: or(
          isNull(users.clerkUpdatedAt),
          sql`${users.clerkUpdatedAt} <= ${fields.clerkUpdatedAt ?? new Date()}`,
        ),
      })
      .returning({ id: users.id });

    this.logger.info(
      {
        event: 'users.sync',
        clerkUserId,
        applied: result.length > 0,
      },
      result.length > 0 ? 'Synced user from Clerk' : 'Skipped stale Clerk user event',
    );
  }

  /**
   * Soft delete. Decks stay intact so a mistaken or replayed `user.deleted` is
   * recoverable via a deliberate restore; authenticated API requests are rejected
   * while `deletedAt` is set.
   */
  async markDeleted(clerkUserId: string): Promise<void> {
    const result = await this.db
      .update(users)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.clerkUserId, clerkUserId))
      .returning({ id: users.id });

    this.logger.info(
      { event: 'users.deleted', clerkUserId, matched: result.length > 0 },
      'Marked user deleted',
    );
  }
}
