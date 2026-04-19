import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';

import { CurrentUserId } from '../../common/auth/current-user-id.decorator';
import { SessionAuthGuard } from '../../common/auth/session-auth.guard';
import { PlayService } from './play.service';

class CreatePlayDto {
  @IsOptional()
  @IsString()
  script_id?: string;

  @IsOptional()
  model_id?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentItems?: string[];
}

@Controller('play')
export class PlayController {
  constructor(private readonly playService: PlayService) {}

  @Post('create')
  @UseGuards(SessionAuthGuard)
  async create(@CurrentUserId() userId: string, @Body() body: CreatePlayDto) {
    const info = await this.playService.create(userId, body);
    if (!info) {
      return {
        result: -1,
        message: 'No playable script available',
      };
    }

    return {
      result: 0,
      info,
    };
  }

  @Get('latest_game')
  @UseGuards(SessionAuthGuard)
  async latestGame(@CurrentUserId() userId: string) {
    return await this.playService.latestGame(userId);
  }

  @Get('query/info')
  async queryInfo(@Query('id') id: string) {
    const { game, plot, script, character, runtime } = await this.playService.queryGameConfig(id);
    return { result: 0, game, plot, script, character, runtime };
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
