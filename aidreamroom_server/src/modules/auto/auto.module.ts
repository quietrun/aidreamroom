import { Module } from '@nestjs/common';

import { GptModule } from '../gpt/gpt.module';
import { AutoController } from './auto.controller';
import { AutoService } from './auto.service';

@Module({
  imports: [GptModule],
  controllers: [AutoController],
  providers: [AutoService],
})
export class AutoModule {}
