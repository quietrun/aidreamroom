import { Module } from '@nestjs/common';

import { GptModule } from '../gpt/gpt.module';
import { ScriptsModule } from '../scripts/scripts.module';
import { StorageModule } from '../storage/storage.module';
import { PlayController } from './play.controller';
import { PlaySocketService } from './gateway/play-socket.service';
import { PlayService } from './play.service';

@Module({
  imports: [GptModule, StorageModule, ScriptsModule],
  controllers: [PlayController],
  providers: [PlayService, PlaySocketService],
  exports: [PlayService],
})
export class PlayModule {}
