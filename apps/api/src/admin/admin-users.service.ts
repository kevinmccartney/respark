import { createClerkClient, type User } from '@clerk/backend';
import { isClerkAPIResponseError } from '@clerk/backend/errors';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { inArray } from 'drizzle-orm';

import {
  ADMIN_USER_LIST_DEFAULT_LIMIT,
  type AdminUser,
  type AdminUserListPage,
} from '@respark/schemas/users';

import { clerkSecretKey } from '../auth/clerk';
import { DATABASE, type Database } from '../db/database.module';
import { users } from '../db/schema';

type LocalUserRow = {
  id: string;
  deletedAt: Date | null;
};

@Injectable()
export class AdminUsersService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  private clerk() {
    return createClerkClient({ secretKey: clerkSecretKey() });
  }

  async listUsers(opts: { q?: string; page?: number; limit?: number }): Promise<AdminUserListPage> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? ADMIN_USER_LIST_DEFAULT_LIMIT;
    const offset = (page - 1) * limit;
    const query = opts.q?.trim() || undefined;

    const result = await this.clerk().users.getUserList({
      limit,
      offset,
      query,
      orderBy: '-created_at',
    });

    const localByClerkId = await this.lookupLocal(result.data.map((user) => user.id));

    return {
      users: result.data.map((user) => this.toAdminUser(user, localByClerkId.get(user.id))),
      total: result.totalCount,
      page,
      pageSize: limit,
      totalPages: result.totalCount === 0 ? 0 : Math.ceil(result.totalCount / limit),
    };
  }

  async getUser(clerkUserId: string): Promise<AdminUser> {
    let user: User;
    try {
      user = await this.clerk().users.getUser(clerkUserId);
    } catch (error) {
      if (isClerkAPIResponseError(error) && error.status === 404) {
        throw new NotFoundException('User not found');
      }
      throw error;
    }

    const localByClerkId = await this.lookupLocal([user.id]);
    return this.toAdminUser(user, localByClerkId.get(user.id));
  }

  private async lookupLocal(clerkUserIds: string[]): Promise<Map<string, LocalUserRow>> {
    const map = new Map<string, LocalUserRow>();
    if (clerkUserIds.length === 0) return map;

    const rows = await this.db
      .select({
        id: users.id,
        clerkUserId: users.clerkUserId,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(inArray(users.clerkUserId, clerkUserIds));

    for (const row of rows) {
      map.set(row.clerkUserId, { id: row.id, deletedAt: row.deletedAt });
    }
    return map;
  }

  private toAdminUser(user: User, local: LocalUserRow | undefined): AdminUser {
    const role = user.publicMetadata?.role === 'admin' ? 'admin' : null;
    return {
      clerkUserId: user.id,
      localUserId: local?.id ?? null,
      email: user.primaryEmailAddress?.emailAddress ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl || null,
      role,
      banned: user.banned,
      locked: user.locked,
      deletedAt: local?.deletedAt ? local.deletedAt.toISOString() : null,
      createdAt: new Date(user.createdAt).toISOString(),
      updatedAt: new Date(user.updatedAt).toISOString(),
      lastSignInAt: user.lastSignInAt ? new Date(user.lastSignInAt).toISOString() : null,
      lastActiveAt: user.lastActiveAt ? new Date(user.lastActiveAt).toISOString() : null,
    };
  }
}
