import type { AdminUserListPage } from '@respark/schemas';

export type UserSearchOpts = {
  q?: string;
  limit?: number;
  page?: number;
};

export type { AdminUserListPage };
