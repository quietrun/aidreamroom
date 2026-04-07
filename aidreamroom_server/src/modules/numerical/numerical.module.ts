import { Module } from '@nestjs/common';

import { NumericalController } from './numerical.controller';
import { NumericalService } from './numerical.service';

@Module({
  controllers: [NumericalController],
  providers: [NumericalService],
})
export class NumericalModule {}
