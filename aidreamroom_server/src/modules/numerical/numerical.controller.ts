import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { NumericalService } from './numerical.service';

class NumericalDto {
  @IsString()
  @IsOptional()
  uuid?: string;

  [key: string]: unknown;
}

class NumericalIdDto {
  @IsString()
  @IsNotEmpty()
  uuid!: string;
}

@Controller('numerical')
export class NumericalController {
  constructor(private readonly numericalService: NumericalService) {}

  @Post('update')
  async update(@Body() body: NumericalDto) {
    await this.numericalService.update(body);
    return { result: 0 };
  }

  @Post('create')
  async create(@Body() body: NumericalDto) {
    await this.numericalService.create(body);
    return { result: 0 };
  }

  @Post('query')
  async query() {
    return {
      result: 0,
      list: await this.numericalService.queryAll(),
    };
  }

  @Post('delete')
  async delete(@Body() body: NumericalIdDto) {
    await this.numericalService.delete(body.uuid);
    return { result: 0 };
  }

  @Post('copy')
  async copy(@Body() body: NumericalIdDto) {
    await this.numericalService.copy(body.uuid);
    return { result: 0 };
  }

  @Get('query/online/type')
  async queryOnlineType() {
    const data = await this.numericalService.queryOnlineType();
    return {
      result: 0,
      data,
    };
  }
}
