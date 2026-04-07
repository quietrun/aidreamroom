import { Global, Module } from '@nestjs/common';

import { LegacyDbService } from './legacy-db.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, LegacyDbService],
  exports: [PrismaService, LegacyDbService],
})
export class PrismaModule {}
