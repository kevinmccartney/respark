import type { AdminUser } from '@respark/schemas';

export const formatUserName = (
  user: Pick<AdminUser, 'firstName' | 'lastName' | 'email'>,
): string => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (user.email) return user.email;
  return 'Unnamed user';
};
