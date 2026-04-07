import { Module } from '@nestjs/common';

import { OutlooksController } from './outlooks.controller';
import { OutlooksService } from './outlooks.service';

@Module({
  controllers: [OutlooksController],
  providers: [OutlooksService],
  exports: [OutlooksService],
})
export class OutlooksModule {}
