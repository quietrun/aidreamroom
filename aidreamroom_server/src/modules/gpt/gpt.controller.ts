import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { CurrentUserId } from '../../common/auth/current-user-id.decorator';
import { SessionAuthGuard } from '../../common/auth/session-auth.guard';
import { MembershipService } from '../membership/membership.service';
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
  constructor(
    private readonly gptService: GptService,
    private readonly membershipService: MembershipService,
  ) {}

  @Post('generate/message')
  @UseGuards(SessionAuthGuard)
  async generateMessage(@CurrentUserId() userId: string, @Body() body: GenerateMessageDto) {
    const hasRemainTimes = await this.membershipService.hasRemainTimes(userId);
    if (!hasRemainTimes) {
      return {
        result: -1,
        msgId: 'AI_DAILY_LIMIT_EXHAUSTED',
        message: '今日 AI 次数已用完',
        limitConfig: await this.membershipService.queryRemainTimes(userId),
      };
    }

    const message = await this.gptService.generateDirectMessage(body.message, body.model);
    if (!message) {
      return {
        result: -1,
        message: '生成失败',
      };
    }

    const limitConfig = await this.membershipService.consumeRemainTime(userId);
    return {
      result: 0,
      message,
      limitConfig,
    };
  }
}
