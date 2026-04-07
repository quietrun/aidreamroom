import { Body, Controller, Post } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { GptService } from './gpt.service';

class GenerateMessageDto {
  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsString()
  @IsOptional()
  model?: string;
}

@Controller('gpt')
export class GptController {
  constructor(private readonly gptService: GptService) {}

  @Post('generate/message')
  async generateMessage(@Body() body: GenerateMessageDto) {
    const message = await this.gptService.generateDirectMessage(body.message, body.model);
    return {
      result: 0,
      message,
    };
  }
}
