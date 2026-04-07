import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { CurrentUserId } from '../../common/auth/current-user-id.decorator';
import { SessionAuthGuard } from '../../common/auth/session-auth.guard';
import {
  MAX_ROLE_ABILITY_LEVEL,
  MAX_ROLE_ATTRIBUTE_TOTAL,
  computeRoleAttributeTotal,
} from './user-role.constants';
import { UserRoleService } from './user-role.service';

class UpdateAbilityDto {
  @IsString()
  @IsNotEmpty()
  abilityKey!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_ROLE_ABILITY_LEVEL)
  level!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  experience?: number;
}

class SaveUserRoleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  gender!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  age!: number;

  @IsString()
  @IsOptional()
  appearanceStyle?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  strength!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  constitution!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  size!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  dexterity!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  appearance!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  intelligence!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  power!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  education!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  luck!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  experience?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  items?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  worlds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAbilityDto)
  abilities?: UpdateAbilityDto[];
}

@Controller('user-role')
export class UserRoleController {
  constructor(private readonly userRoleService: UserRoleService) {}

  private validateAttributeTotal(body: SaveUserRoleDto) {
    const total = computeRoleAttributeTotal(body);
    if (total > MAX_ROLE_ATTRIBUTE_TOTAL) {
      return {
        result: -1,
        message: `九维总值不能超过 ${MAX_ROLE_ATTRIBUTE_TOTAL}`,
      };
    }

    return null;
  }

  @Get('exists')
  @UseGuards(SessionAuthGuard)
  async exists(@CurrentUserId() userId: string) {
    return {
      result: 0,
      exists: await this.userRoleService.exists(userId),
    };
  }

  @Get('profile')
  @UseGuards(SessionAuthGuard)
  async profile(@CurrentUserId() userId: string) {
    return {
      result: 0,
      role: await this.userRoleService.queryProfile(userId),
    };
  }

  @Post('create')
  @UseGuards(SessionAuthGuard)
  async create(@CurrentUserId() userId: string, @Body() body: SaveUserRoleDto) {
    const totalValidation = this.validateAttributeTotal(body);
    if (totalValidation) {
      return totalValidation;
    }

    const role = await this.userRoleService.create(userId, body);
    if (!role) {
      return {
        result: -1,
        message: '角色已创建',
      };
    }

    return {
      result: 0,
      role,
    };
  }

  @Post('update')
  @UseGuards(SessionAuthGuard)
  async update(@CurrentUserId() _userId: string, @Body() _body: SaveUserRoleDto) {
    return {
      result: -1,
      message: '角色创建后不可修改',
    };
  }
}
