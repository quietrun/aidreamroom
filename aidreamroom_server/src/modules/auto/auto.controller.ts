import { Controller, Get, Query } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { AutoService } from './auto.service';

class CharacterBackgroundQuery {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  race?: string;

  @IsString()
  @IsOptional()
  sex?: string;

  @IsString()
  @IsOptional()
  age?: string;

  @IsString()
  @IsOptional()
  job?: string;

  @IsString()
  @IsOptional()
  item?: string;
}

@Controller('auto')
export class AutoController {
  constructor(private readonly autoService: AutoService) {}

  @Get('character')
  async generateCharacter() {
    const info = await this.autoService.generateCharacter();
    return {
      result: 0,
      info,
    };
  }

  @Get('character/background')
  async generateBackground(@Query() query: CharacterBackgroundQuery) {
    const info = await this.autoService.generateBackground(query);
    return {
      result: 0,
      info,
    };
  }
}
