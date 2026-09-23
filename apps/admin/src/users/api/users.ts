import {
  adminUserListPageSchema,
  adminUserResponseSchema,
  type AdminUser,
  type AdminUserListPage,
} from '@respark/schemas';

import { apiFetchJson, type GetToken } from '@respark-admin/core/lib';

import type { UserSearchOpts } from '../types';

export const fetchUsers = (
  getToken: GetToken,
  opts: UserSearchOpts,
  init?: RequestInit,
): Promise<AdminUserListPage> => {
  const params = new URLSearchParams();
  if (opts.q) params.set('q', opts.q);
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts.page !== undefined && opts.page > 1) params.set('page', String(opts.page));

  const qs = params.toString();
  return apiFetchJson(`/admin/users${qs ? `?${qs}` : ''}`, getToken, adminUserListPageSchema, init);
};

export const fetchUser = (
  getToken: GetToken,
  clerkUserId: string,
  init?: RequestInit,
): Promise<AdminUser> =>
  apiFetchJson(
    `/admin/users/${encodeURIComponent(clerkUserId)}`,
    getToken,
    adminUserResponseSchema,
    init,
  ).then((data) => data.user);
