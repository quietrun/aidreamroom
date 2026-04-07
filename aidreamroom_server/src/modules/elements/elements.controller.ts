import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { CurrentUserId } from '../../common/auth/current-user-id.decorator';
import { SessionAuthGuard } from '../../common/auth/session-auth.guard';
import { ElementsService } from './elements.service';

class SaveElementDto {
  @IsString()
  @IsOptional()
  uuid?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  descript?: string;

  @IsOptional()
  worldType?: string | number;

  @IsOptional()
  type?: number;

  @IsString()
  @IsOptional()
  images?: string;

  @IsString()
  @IsOptional()
  parent?: string;

  @IsOptional()
  materialType?: number;

  @IsOptional()
  isShared?: boolean;
}

class HideItemDto {
  @IsArray()
  list!: string[];

  @IsBoolean()
  isHide!: boolean;
}

class UpdateCartDto {
  @IsArray()
  list!: string[];
}

class ImportItemsDto {
  @IsArray()
  list!: string[];
}

@Controller('element')
export class ElementsController {
  constructor(private readonly elementsService: ElementsService) {}

  @Post('create')
  @UseGuards(SessionAuthGuard)
  async create(@CurrentUserId() userId: string, @Body() body: SaveElementDto) {
    return {
      result: 0,
      data: await this.elementsService.create(userId, body),
    };
  }

  @Post('update')
  async update(@Body() body: SaveElementDto) {
    return {
      result: 0,
      data: await this.elementsService.update({ ...body }),
    };
  }

  @Get('delete')
  async delete(@Query('uuid') uuid: string) {
    await this.elementsService.softDelete(uuid.split(','));
    return { result: 0 };
  }

  @Get('list')
  @UseGuards(SessionAuthGuard)
  async list(@CurrentUserId() userId: string) {
    return {
      result: 0,
      list: await this.elementsService.listByCreator(userId),
    };
  }

  @Get('list/not_mine')
  @UseGuards(SessionAuthGuard)
  async listNotMine(@CurrentUserId() userId: string) {
    return {
      result: 0,
      list: await this.elementsService.listNotMine(userId),
    };
  }

  @Get('list/shared')
  @UseGuards(SessionAuthGuard)
  async listShared(@CurrentUserId() userId: string) {
    return {
      result: 0,
      list: await this.elementsService.listShared(userId),
    };
  }

  @Post('update/hide/item')
  @UseGuards(SessionAuthGuard)
  async updateHide(@CurrentUserId() userId: string, @Body() body: HideItemDto) {
    await this.elementsService.updateHiddenItems(userId, body.list, body.isHide);
    return { result: 0 };
  }

  @Post('update/cart')
  @UseGuards(SessionAuthGuard)
  async updateCart(@CurrentUserId() userId: string, @Body() body: UpdateCartDto) {
    await this.elementsService.updateCart(userId, body.list);
    return { result: 0 };
  }

  @Get('query/hidden/items')
  @UseGuards(SessionAuthGuard)
  async queryHidden(@CurrentUserId() userId: string) {
    return {
      result: 0,
      list: await this.elementsService.queryHiddenItems(userId),
    };
  }

  @Post('import/items')
  @UseGuards(SessionAuthGuard)
  async importItems(@CurrentUserId() userId: string, @Body() body: ImportItemsDto) {
    await this.elementsService.importItems(userId, body.list);
    return { result: 0 };
  }
}

