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
import { PlotsService } from './plots.service';

class SavePlotDto {
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

  @IsString()
  @IsOptional()
  plotTarget?: string;
}

class QueryUuidDto {
  @IsString()
  @IsNotEmpty()
  uuid!: string;
}

class SaveBranchDto {
  @IsString()
  @IsOptional()
  uuid?: string;

  @IsString()
  @IsOptional()
  parent?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  descript?: string;

  @IsString()
  @IsOptional()
  conditionIds?: string;

  @IsString()
  @IsOptional()
  images?: string;

  @IsOptional()
  isSub?: boolean;

  @IsString()
  @IsOptional()
  subParentId?: string;

  @IsOptional()
  plotType?: number;

  @IsString()
  @IsOptional()
  metrics?: string;
}

class SaveKnowledgeDto {
  @IsString()
  @IsOptional()
  uuid?: string;

  @IsString()
  @IsOptional()
  parent?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  descript?: string;

  @IsOptional()
  materialType?: number;

  @IsString()
  @IsOptional()
  images?: string;
}

class DeleteKnowledgeDto {
  @IsArray()
  ids!: string[];
}

class SavePlotItemDto {
  @IsString()
  @IsOptional()
  plotId?: string;

  @IsString()
  @IsOptional()
  itemId?: string;

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

class PositionRecordDto {
  @IsArray()
  list!: Array<{ uuid?: string; x?: number; y?: number; itemId?: string }>;
}

class PositionQueryDto {
  @IsArray()
  list!: Array<{ itemId: string }>;
}

class RemovePlotItemsDto {
  @IsArray()
  ids!: string[];
}

class EditSimpleDto {
  @IsString()
  @IsNotEmpty()
  uuid!: string;

  @IsString()
  @IsOptional()
  plotParent?: string;

  @IsString()
  @IsOptional()
  conditionIds?: string;

  @IsString()
  @IsOptional()
  id?: string;
}

@Controller('plot')
export class PlotsController {
  constructor(private readonly plotsService: PlotsService) {}

  @Post('create')
  @UseGuards(SessionAuthGuard)
  async create(@CurrentUserId() userId: string, @Body() body: SavePlotDto) {
    const plot = await this.plotsService.create(userId, body);
    return { result: 0, plot };
  }

  @Post('query/item')
  async queryItem(@Body() body: QueryUuidDto) {
    return {
      result: 0,
      plot: await this.plotsService.queryItem(body.uuid),
    };
  }

  @Post('update')
  async update(@Body() body: SavePlotDto) {
    const plot = await this.plotsService.update({ ...body });
    return { result: 0, plot };
  }

  @Post('create/branch')
  @UseGuards(SessionAuthGuard)
  async createBranch(@CurrentUserId() userId: string, @Body() body: SaveBranchDto) {
    const branch = await this.plotsService.createBranch(userId, body);
    return { result: 0, branch };
  }

  @Post('query/branch')
  async queryBranch(@Body() body: QueryUuidDto) {
    const result = await this.plotsService.queryBranch(body.uuid);
    return {
      result: 0,
      branch: result.branch,
      elements: result.elements,
    };
  }

  @Post('update/branch')
  async updateBranch(@Body() body: SaveBranchDto) {
    const branch = await this.plotsService.updateBranch({ ...body });
    return { result: 0, branch };
  }

  @Get('query/branch/list')
  async queryBranchList(@Query('parent') parent: string) {
    return {
      result: 0,
      list: await this.plotsService.queryBranchList(parent),
    };
  }

  @Get('query/knowledge/list')
  async queryKnowledgeList(@Query('parent') parent: string) {
    return {
      result: 0,
      list: await this.plotsService.queryKnowledgeList(parent),
    };
  }

  @Post('delete/knowledge')
  async deleteKnowledge(@Body() body: DeleteKnowledgeDto) {
    await this.plotsService.deleteKnowledge(body.ids);
    return { result: 0 };
  }

  @Post('create/knowledge')
  async createKnowledge(@Body() body: SaveKnowledgeDto) {
    const knowledge = await this.plotsService.createKnowledge({ ...body });
    return { result: 0, knowledge };
  }

  @Post('update/knowledge')
  async updateKnowledge(@Body() body: SaveKnowledgeDto) {
    const data = await this.plotsService.updateKnowledge({ ...body });
    return { result: 0, data };
  }

  @Post('create/item')
  @UseGuards(SessionAuthGuard)
  async createItem(@CurrentUserId() userId: string, @Body() body: SavePlotItemDto) {
    const item = await this.plotsService.createItem(userId, body);
    return { result: 0, item };
  }

  @Post('edit')
  async edit(@Body() body: SavePlotDto & { uuid: string }) {
    await this.plotsService.editPlot(body);
    return { result: 0, id: body.uuid };
  }

  @Post('position/record')
  async recordPosition(@Body() body: PositionRecordDto) {
    await this.plotsService.recordPositions(body.list);
    return { result: 0 };
  }

  @Post('query/position')
  async queryPosition(@Body() body: PositionQueryDto) {
    return {
      result: 0,
      map: await this.plotsService.queryPositions(body.list),
    };
  }

  @Post('edit/item')
  @UseGuards(SessionAuthGuard)
  async editItem(@CurrentUserId() userId: string, @Body() body: SavePlotItemDto) {
    const item = await this.plotsService.editItem(userId, body);
    return { result: 0, item };
  }

  @Post('edit/branch')
  async editBranch(@Body() body: EditSimpleDto) {
    await this.plotsService.editBranchParent(body.uuid, body.plotParent ?? '');
    return { result: 0, item: { uuid: body.uuid, plotParent: body.plotParent ?? '' } };
  }

  @Post('edit/condition')
  async editCondition(@Body() body: EditSimpleDto) {
    await this.plotsService.editCondition(body.uuid, body.conditionIds ?? '');
    return { result: 0, item: { uuid: body.uuid, conditionIds: body.conditionIds ?? '' } };
  }

  @Post('remove/item/sub')
  async removeItemSub(@Body() body: EditSimpleDto) {
    await this.plotsService.removeItemSub(body.id ?? '');
    return { result: 0 };
  }

  @Post('remove/item')
  async removeItem(@Body() body: RemovePlotItemsDto) {
    await this.plotsService.removeItems(body.ids);
    return { result: 0 };
  }

  @Get('list')
  @UseGuards(SessionAuthGuard)
  async list(@CurrentUserId() userId: string) {
    return {
      result: 0,
      list: await this.plotsService.listByCreator(userId),
    };
  }

  @Get('list/all')
  async listAll() {
    return {
      result: 0,
      list: await this.plotsService.listAll(),
    };
  }

  @Get('list/item')
  async listItem(@Query('plotId') plotId: string) {
    return {
      result: 0,
      list: await this.plotsService.listItems(plotId),
    };
  }
}

