import { Module } from '@nestjs/common';

import { ItemsModule } from '../items/items.module';
import { SkillsModule } from '../skills/skills.module';
import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';

@Module({
  imports: [ItemsModule, SkillsModule],
  controllers: [WarehouseController],
  providers: [WarehouseService],
  exports: [WarehouseService],
})
export class WarehouseModule {}
