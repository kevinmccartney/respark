import { useAuth } from '@clerk/react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { clerkUserIdSchema } from '@respark/schemas';

import { fetchUser, fetchUsers } from '../api/users';
import type { UserSearchOpts } from '../types';

const USER_KEYS = {
  all: ['users'] as const,
  search: (opts: UserSearchOpts) => [...USER_KEYS.all, 'search', opts] as const,
  detail: (clerkUserId: string) => [...USER_KEYS.all, 'detail', clerkUserId] as const,
};

export const useSearchUsers = (opts: UserSearchOpts) => {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: USER_KEYS.search(opts),
    queryFn: ({ signal }) => fetchUsers(getToken, opts, { signal }),
    placeholderData: keepPreviousData,
  });
};

export const useUser = (clerkUserId: string) => {
  const { getToken } = useAuth();
  const validId = clerkUserIdSchema.safeParse(clerkUserId).success;
  return useQuery({
    queryKey: USER_KEYS.detail(clerkUserId),
    queryFn: ({ signal }) => fetchUser(getToken, clerkUserId, { signal }),
    enabled: validId,
  });
};
