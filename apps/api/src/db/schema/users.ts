import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Local identity for a Clerk user. Clerk owns authentication; this row owns the
 * primary key every other table references, so nothing else depends on Clerk ids.
 *
 * Profile columns are a cache of Clerk's copy, kept fresh by the user.* webhooks.
 * Treat Clerk as the source of truth and never write them from app code.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id').notNull().unique(),

  email: text('email'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  imageUrl: text('image_url'),

  /**
   * `updated_at` from the Clerk payload. Webhooks can arrive out of order, so a
   * sync is skipped when the incoming event is older than what we already stored.
   */
  clerkUpdatedAt: timestamp('clerk_updated_at', { withTimezone: true }),

  /** Set by `user.deleted`. Soft delete so a webhook can never destroy deck history. */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type UserRow = typeof users.$inferSelect
