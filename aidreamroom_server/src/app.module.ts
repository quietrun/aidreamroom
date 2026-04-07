import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { SessionAuthModule } from './common/auth/session-auth.module';
import appConfig from './common/config/app.config';
import { PrismaModule } from './common/database/prisma.module';
import { AutoModule } from './modules/auto/auto.module';
import { CharactersModule } from './modules/characters/characters.module';
import { ElementsModule } from './modules/elements/elements.module';
import { FilesModule } from './modules/files/files.module';
import { GptModule } from './modules/gpt/gpt.module';
import { ItemsModule } from './modules/items/items.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { NumericalModule } from './modules/numerical/numerical.module';
import { OutlooksModule } from './modules/outlooks/outlooks.module';
import { PlayModule } from './modules/play/play.module';
import { PlotsModule } from './modules/plots/plots.module';
import { SkillsModule } from './modules/skills/skills.module';
import { StorageModule } from './modules/storage/storage.module';
import { UserRoleModule } from './modules/user-role/user-role.module';
import { UsersModule } from './modules/users/users.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    SessionAuthModule,
    NotificationsModule,
    StorageModule,
    UsersModule,
    UserRoleModule,
    ItemsModule,
    WarehouseModule,
    OutlooksModule,
    PlotsModule,
    CharactersModule,
    ElementsModule,
    PlayModule,
    SkillsModule,
    AutoModule,
    GptModule,
    FilesModule,
    NumericalModule,
  ],
})
export class AppModule {}

