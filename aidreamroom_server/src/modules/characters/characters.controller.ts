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
import { CharactersService } from './characters.service';

class SaveCharacterDto {
  info!: Record<string, unknown>;

  @IsString()
  @IsOptional()
  image?: string;

  @IsOptional()
  worldType?: string | number;

  @IsString()
  @IsOptional()
  metrics?: string;

  @IsString()
  @IsOptional()
  uuid?: string;
}

class RemoveCharacterDto {
  @IsArray()
  uuid!: string[];
}

@Controller('character')
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @Post('add')
  @UseGuards(SessionAuthGuard)
  async add(@CurrentUserId() userId: string, @Body() body: SaveCharacterDto) {
    return {
      result: 0,
      info: await this.charactersService.saveCharacter(userId, body),
    };
  }

  @Post('edit')
  @UseGuards(SessionAuthGuard)
  async edit(@CurrentUserId() userId: string, @Body() body: SaveCharacterDto) {
    return {
      result: 0,
      info: await this.charactersService.saveCharacter(userId, body),
    };
  }

  @Post('remove')
  async remove(@Body() body: RemoveCharacterDto) {
    await this.charactersService.removeCharacters(body.uuid);
    return { result: 0 };
  }

  @Get('list')
  @UseGuards(SessionAuthGuard)
  async list(@CurrentUserId() userId: string) {
    return {
      result: 0,
      list: await this.charactersService.listByCreator(userId),
    };
  }

  @Get('list/all')
  async listAll() {
    return {
      result: 0,
      list: await this.charactersService.listAll(),
    };
  }
}
