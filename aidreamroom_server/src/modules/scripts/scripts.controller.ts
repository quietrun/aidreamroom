import { Controller, Get, Query } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';

import { ScriptsService } from './scripts.service';

class QueryScriptDto {
  @IsString()
  @IsNotEmpty()
  uuid!: string;
}

@Controller('script')
export class ScriptsController {
  constructor(private readonly scriptsService: ScriptsService) {}

  @Get('query')
  async query(@Query() query: QueryScriptDto) {
    const script = await this.scriptsService.queryByUuid(query.uuid);
    if (!script) {
      return {
        result: -1,
        message: '剧本不存在',
      };
    }

    return {
      result: 0,
      script,
    };
  }

  @Get('random')
  async random() {
    const script = await this.scriptsService.queryRandom();
    if (!script) {
      return {
        result: -1,
        message: '剧本表为空',
      };
    }

    return {
      result: 0,
      script,
    };
  }
}
