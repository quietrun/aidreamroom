import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { CurrentUserId } from '../../common/auth/current-user-id.decorator';
import { SessionAuthGuard } from '../../common/auth/session-auth.guard';
import { WAREHOUSE_ENTRY_TYPES } from './warehouse.constants';
import { WarehouseService } from './warehouse.service';

class ExpandWarehouseDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  amount?: number;
}

class StoreWarehouseDto {
  @IsOptional()
  @IsString()
  @IsIn(WAREHOUSE_ENTRY_TYPES)
  entryType?: string;

  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsString()
  skillId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  remainingUses?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  durabilityCurrent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  durabilityMax?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isEquipped?: boolean;

  @IsOptional()
  @IsString()
  equippedSlot?: string;

  @IsOptional()
  @IsArray()
  affixConfig?: unknown[];
}

class DiscardWarehouseDto {
  @IsString()
  @IsNotEmpty()
  entryId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity?: number;
}

@Controller('warehouse')
@UseGuards(SessionAuthGuard)
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get('profile')
  async profile(@CurrentUserId() userId: string) {
    return {
      result: 0,
      profile: await this.warehouseService.queryProfile(userId),
    };
  }

  @Post('expand')
  async expand(@CurrentUserId() userId: string, @Body() body: ExpandWarehouseDto) {
    return {
      result: 0,
      profile: await this.warehouseService.expandWarehouse(userId, body.amount ?? 10),
    };
  }

  @Post('store')
  async store(@CurrentUserId() userId: string, @Body() body: StoreWarehouseDto) {
    const profile = await this.warehouseService.storeEntry(userId, body);
    if (!profile) {
      return {
        result: -1,
        message: '仓库空间不足',
      };
    }

    return {
      result: 0,
      profile,
    };
  }

  @Post('discard')
  async discard(@CurrentUserId() userId: string, @Body() body: DiscardWarehouseDto) {
    const profile = await this.warehouseService.discardEntry(userId, body.entryId, body.quantity ?? 1);
    if (!profile) {
      return {
        result: -1,
        message: '仓库条目不存在',
      };
    }

    return {
      result: 0,
      profile,
    };
  }
}
