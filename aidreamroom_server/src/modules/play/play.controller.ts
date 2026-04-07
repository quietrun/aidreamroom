import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { CurrentUserId } from '../../common/auth/current-user-id.decorator';
import { SessionAuthGuard } from '../../common/auth/session-auth.guard';
import { PlayService } from './play.service';

class CreatePlayDto {
  @IsString()
  @IsNotEmpty()
  plot_id!: string;

  @IsString()
  @IsNotEmpty()
  character_id!: string;

  @IsOptional()
  model_id?: number;
}

@Controller('play')
export class PlayController {
  constructor(private readonly playService: PlayService) {}

  @Post('create')
  @UseGuards(SessionAuthGuard)
  async create(@CurrentUserId() userId: string, @Body() body: CreatePlayDto) {
    return {
      result: 0,
      info: await this.playService.create(userId, body),
    };
  }

  @Get('latest_game')
  @UseGuards(SessionAuthGuard)
  async latestGame(@CurrentUserId() userId: string) {
    return await this.playService.latestGame(userId);
  }

  @Get('query/info')
  async queryInfo(@Query('id') id: string) {
    const { game, plot, character, plotList } = await this.playService.queryGameConfig(id);
    return { result: 0, game, plot, character, plotList };
  }

  @Get('query/times/remain')
  @UseGuards(SessionAuthGuard)
  async queryTimesRemain(@CurrentUserId() userId: string) {
    return {
      result: 0,
      config: await this.playService.queryRemainTimes(userId),
    };
  }

  @Get('query/module/list')
  async queryModuleList() {
    return {
      result: 0,
      moduleList: this.playService.queryModuleList(),
    };
  }

  @Get('query/history')
  @UseGuards(SessionAuthGuard)
  async queryHistory(@CurrentUserId() userId: string) {
    return {
      result: 0,
      gameList: await this.playService.queryHistory(userId),
    };
  }
}
