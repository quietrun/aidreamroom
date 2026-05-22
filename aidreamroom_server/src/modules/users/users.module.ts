import { Module } from '@nestjs/common';

import { SessionAuthModule } from '../../common/auth/session-auth.module';
import { MembershipModule } from '../membership/membership.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SessionAuthModule, NotificationsModule, MembershipModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
