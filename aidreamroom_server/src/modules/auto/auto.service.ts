import { Injectable } from '@nestjs/common';

import { WORLD_TYPES } from '../../common/utils/legacy.constants';
import { GptService } from '../gpt/gpt.service';

@Injectable()
export class AutoService {
  constructor(private readonly gptService: GptService) {}

  async generateCharacter() {
    const selected = WORLD_TYPES[Math.floor(Math.random() * WORLD_TYPES.length)];
    const prompt = `请用中文生成一个 ${selected.text} 世界观角色，并严格只返回 JSON：{"name":"","race":"","sex":"","age":"","job":"","item":"","background":""}`;
    const message = await this.gptService.generateAutoCharacter(prompt);
    const info = JSON.parse(message) as Record<string, unknown>;
    return {
      ...info,
      worldType: selected.id,
    };
  }

  async generateBackground(query: {
    name: string;
    race?: string;
    sex?: string;
    age?: string;
    job?: string;
    item?: string;
  }) {
    const prompt = `请用中文为以下角色生成一段背景故事，并严格只返回 JSON：{"background":""}。姓名：${query.name}；种族：${query.race ?? ''}；性别：${query.sex ?? ''}；年龄：${query.age ?? ''}；职业：${query.job ?? ''}；物品：${query.item ?? ''}`;
    const message = await this.gptService.generateAutoCharacter(prompt);
    return JSON.parse(message) as { background: string };
  }
}
