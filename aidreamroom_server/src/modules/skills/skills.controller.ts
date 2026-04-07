import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { CurrentUserId } from '../../common/auth/current-user-id.decorator';
import { SessionAuthGuard } from '../../common/auth/session-auth.guard';
import { SkillsService } from './skills.service';

class SkillRequirementDto {
  @IsString()
  @IsNotEmpty()
  abilityKey!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  requiredLevel!: number;
}

class SkillFormulaTermDto {
  @IsString()
  @IsIn(['constant', 'attribute', 'ability'])
  type!: string;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  value?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  scale?: number;
}

class SkillFormulaConfigDto {
  @IsOptional()
  @IsString()
  @IsIn(['round', 'floor', 'ceil'])
  roundMode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  min?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  max?: number | null;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SkillFormulaTermDto)
  terms!: SkillFormulaTermDto[];
}

class SaveSkillDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  formulaLabel?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => SkillFormulaConfigDto)
  formulaConfig!: SkillFormulaConfigDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SkillRequirementDto)
  requirements?: SkillRequirementDto[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

@Controller('skills')
@UseGuards(SessionAuthGuard)
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get('list')
  async list(@CurrentUserId() userId: string) {
    return {
      result: 0,
      list: await this.skillsService.queryListByUser(userId),
    };
  }

  @Get('detail/:id')
  async detail(@CurrentUserId() userId: string, @Param('id') id: string) {
    const skill = await this.skillsService.queryDetailByUser(userId, id);
    if (!skill) {
      return {
        result: -1,
        message: '技能不存在',
      };
    }

    return {
      result: 0,
      skill,
    };
  }

  @Post('create')
  async create(@Body() body: SaveSkillDto) {
    const skill = await this.skillsService.create(body);
    return {
      result: 0,
      skill,
    };
  }

  @Post('update/:id')
  async update(@Param('id') id: string, @Body() body: SaveSkillDto) {
    const skill = await this.skillsService.update(id, body);
    if (!skill) {
      return {
        result: -1,
        message: '技能不存在',
      };
    }

    return {
      result: 0,
      skill,
    };
  }
}
