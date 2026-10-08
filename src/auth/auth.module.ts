import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CsrfGuard, MobileAuthGuard, SessionAuthGuard, SuperadminGuard } from './auth.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard, SuperadminGuard, CsrfGuard, MobileAuthGuard],
  exports: [AuthService, SessionAuthGuard, SuperadminGuard, CsrfGuard, MobileAuthGuard],
})
export class AuthModule {}
