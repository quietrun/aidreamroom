import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { CurrentUserId } from '../../common/auth/current-user-id.decorator';
import { SessionAuthGuard } from '../../common/auth/session-auth.guard';
import { ITEM_EQUIPMENT_SLOT_CONFIG, ITEM_TYPES } from './items.constants';
import { ItemsService } from './items.service';

class SaveItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsIn(ITEM_TYPES)
  itemType!: string;

  @IsOptional()
  @IsString()
  @IsIn(ITEM_EQUIPMENT_SLOT_CONFIG.map((item) => item.key))
  itemSubType?: string;

  @IsOptional()
  @IsString()
  effectLabel?: string;

  @IsOptional()
  @IsObject()
  effectConfig?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  formulaLabel?: string;

  @IsOptional()
  @IsObject()
  formulaConfig?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  stackLimit?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

@Controller('items')
@UseGuards(SessionAuthGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get('list')
  async list(@CurrentUserId() userId: string) {
    return {
      result: 0,
      list: await this.itemsService.queryListByUser(userId),
    };
  }

  @Get('detail/:id')
  async detail(@CurrentUserId() userId: string, @Param('id') id: string) {
    const item = await this.itemsService.queryDetailByUser(userId, id);
    if (!item) {
      return {
        result: -1,
        message: '物品不存在',
      };
    }

    return {
      result: 0,
      item,
    };
  }

  @Post('create')
  async create(@Body() body: SaveItemDto) {
    const item = await this.itemsService.create(body);
    return {
      result: 0,
      item,
    };
  }

  @Post('update/:id')
  async update(@Param('id') id: string, @Body() body: SaveItemDto) {
    const item = await this.itemsService.update(id, body);
    if (!item) {
      return {
        result: -1,
        message: '物品不存在',
      };
    }

    return {
      result: 0,
      item,
    };
  }
}
