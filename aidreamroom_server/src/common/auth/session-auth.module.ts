import { Global, Module } from '@nestjs/common';

import { SessionAuthGuard } from './session-auth.guard';
import { SessionAuthService } from './session-auth.service';

@Global()
@Module({
  providers: [SessionAuthService, SessionAuthGuard],
  exports: [SessionAuthService, SessionAuthGuard],
})
export class SessionAuthModule {}
