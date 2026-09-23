import { z } from 'zod';

import { isoDateTimeSchema, queryIntSchema, uuidSchema } from './primitives.js';

export const ADMIN_USER_LIST_DEFAULT_LIMIT = 25;
export const ADMIN_USER_LIST_MAX_LIMIT = 100;

export const clerkUserIdSchema = z.string().min(1).max(128);

/** App-specific role stored in Clerk `publicMetadata.role`. */
export const adminUserRoleSchema = z.enum(['admin']);

export type AdminUserRole = z.infer<typeof adminUserRoleSchema>;

export const adminUserSchema = z.object({
  clerkUserId: clerkUserIdSchema,
  /** Local `app.users.id` when the Clerk profile has been synced. */
  localUserId: uuidSchema.nullable(),
  email: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  imageUrl: z.string().nullable(),
  role: adminUserRoleSchema.nullable(),
  banned: z.boolean(),
  locked: z.boolean(),
  deletedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  lastSignInAt: isoDateTimeSchema.nullable(),
  lastActiveAt: isoDateTimeSchema.nullable(),
});

export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUserListQuerySchema = z.object({
  q: z.string().optional(),
  limit: queryIntSchema(1, ADMIN_USER_LIST_MAX_LIMIT),
  page: queryIntSchema(1, 10_000),
});

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;

export const adminUserListPageSchema = z.object({
  users: z.array(adminUserSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});

export type AdminUserListPage = z.infer<typeof adminUserListPageSchema>;

export const adminUserResponseSchema = z.object({
  user: adminUserSchema,
});

export type AdminUserResponse = z.infer<typeof adminUserResponseSchema>;
