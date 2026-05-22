import { Module } from '@nestjs/common';

import { MembershipModule } from '../membership/membership.module';
import { GptController } from './gpt.controller';
import { GptService } from './gpt.service';

@Module({
  imports: [MembershipModule],
  controllers: [GptController],
  providers: [GptService],
  exports: [GptService],
})
export class GptModule {}
