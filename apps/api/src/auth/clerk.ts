import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createClerkClient, verifyToken } from '@clerk/backend';

export const clerkSecretKey = (): string => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new UnauthorizedException('CLERK_SECRET_KEY is not configured');
  }
  return secretKey;
};

/** Returns the Clerk user id (`sub`) for a session JWT. */
export const verifyClerkToken = async (token: string): Promise<string> => {
  const payload = await verifyToken(token, { secretKey: clerkSecretKey() });
  if (!payload.sub) {
    throw new UnauthorizedException('Invalid session token');
  }
  return payload.sub;
};

export const assertAdminUser = async (userId: string): Promise<void> => {
  const clerk = createClerkClient({ secretKey: clerkSecretKey() });
  const user = await clerk.users.getUser(userId);
  if (user.publicMetadata?.role !== 'admin') {
    throw new ForbiddenException('Admin role required');
  }
};
