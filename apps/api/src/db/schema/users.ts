import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Local identity for a Clerk user. Clerk owns authentication; this row owns the
 * primary key every other table references, so nothing else depends on Clerk ids.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type UserRow = typeof users.$inferSelect
