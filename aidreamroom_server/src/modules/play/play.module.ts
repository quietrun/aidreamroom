import { Module } from '@nestjs/common';

import { GptModule } from '../gpt/gpt.module';
import { StorageModule } from '../storage/storage.module';
import { PlayController } from './play.controller';
import { PlaySocketService } from './gateway/play-socket.service';
import { PlayService } from './play.service';

@Module({
  imports: [GptModule, StorageModule],
  controllers: [PlayController],
  providers: [PlayService, PlaySocketService],
  exports: [PlayService],
})
export class PlayModule {}
