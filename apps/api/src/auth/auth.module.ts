import { Global, Module } from '@nestjs/common';
import { AdminRoleGuard } from './admin-role.guard';
import { ClerkAuthGuard } from './clerk-auth.guard';

@Global()
@Module({
  providers: [ClerkAuthGuard, AdminRoleGuard],
  exports: [ClerkAuthGuard, AdminRoleGuard],
})
export class AuthModule {}
