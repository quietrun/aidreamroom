import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { CurrentUserId } from '../../common/auth/current-user-id.decorator';
import { SessionAuthGuard } from '../../common/auth/session-auth.guard';
import { OutlooksService } from './outlooks.service';

class SaveOutlookDto {
  @IsString()
  @IsOptional()
  uuid?: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  descript?: string;

  @IsOptional()
  worldType?: string | number;
}

class QueryOutlookDto {
  @IsString()
  @IsNotEmpty()
  uuid!: string;
}

class SaveOutlookItemDto {
  @IsString()
  @IsOptional()
  itemId?: string;

  @IsString()
  @IsOptional()
  outlookId?: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  type?: number;

  @IsString()
  @IsOptional()
  descript?: string;

  @IsString()
  @IsOptional()
  images?: string;
}

class RemoveItemsDto {
  @IsArray()
  ids!: string[];
}

@Controller('outlook')
export class OutlooksController {
  constructor(private readonly outlooksService: OutlooksService) {}

  @Post('create')
  @UseGuards(SessionAuthGuard)
  async create(@CurrentUserId() userId: string, @Body() body: SaveOutlookDto) {
    const id = await this.outlooksService.create(userId, body);
    return { result: 0, id };
  }

  @Post('update')
  async update(@Body() body: SaveOutlookDto) {
    await this.outlooksService.update(body);
    return { result: 0, id: body.uuid };
  }

  @Post('query/item')
  async queryItem(@Body() body: QueryOutlookDto) {
    return {
      result: 0,
      outlook: await this.outlooksService.queryItem(body.uuid),
    };
  }

  @Post('create/item')
  @UseGuards(SessionAuthGuard)
  async createItem(@CurrentUserId() userId: string, @Body() body: SaveOutlookItemDto) {
    return {
      result: 0,
      item: await this.outlooksService.createItem(userId, body),
    };
  }

  @Post('edit/item')
  @UseGuards(SessionAuthGuard)
  async editItem(@CurrentUserId() userId: string, @Body() body: SaveOutlookItemDto) {
    return {
      result: 0,
      item: await this.outlooksService.editItem(userId, body),
    };
  }

  @Post('remove/item')
  async removeItem(@Body() body: RemoveItemsDto) {
    await this.outlooksService.removeItems(body.ids);
    return { result: 0 };
  }

  @Get('list')
  @UseGuards(SessionAuthGuard)
  async list(@CurrentUserId() userId: string) {
    return {
      result: 0,
      list: await this.outlooksService.listByCreator(userId),
    };
  }

  @Get('list/all')
  async listAll() {
    return {
      result: 0,
      list: await this.outlooksService.listAll(),
    };
  }

  @Get('list/item')
  async listItem(@Query('outlookId') outlookId: string) {
    return {
      result: 0,
      list: await this.outlooksService.listItems(outlookId),
    };
  }
}
