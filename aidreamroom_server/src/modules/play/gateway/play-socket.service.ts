import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LegacyDbService } from '../../../common/database/legacy-db.service';
import { MODULE_LIST } from '../../../common/utils/legacy.constants';
import { formatKnowledge, formatWorldTypes, createPlayPrompt } from './play-prompt.util';
import { GptService } from '../../gpt/gpt.service';
import { MinioStorageService } from '../../storage/minio-storage.service';
import { PlayService } from '../play.service';

const websocket = require('nodejs-websocket');

@Injectable()
export class PlaySocketService implements OnModuleInit, OnModuleDestroy {
  private server: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly playService: PlayService,
    private readonly gptService: GptService,
    private readonly storageService: MinioStorageService,
    private readonly db: LegacyDbService,
  ) {}

  onModuleInit() {
    const port = this.configService.get<number>('app.legacyWsPort', 3300);
    this.server = websocket.createServer((connection: any) => {
      const session = new GameSocketSession(
        connection,
        this.playService,
        this.gptService,
        this.storageService,
        this.db,
      );
      session.bind();
    });
    this.server.listen(port);
  }

  onModuleDestroy() {
    if (this.server?.close) {
      this.server.close();
    }
  }
}

class GameSocketSession {
  private gameId = '';
  private userId = '';
  private game: Record<string, unknown> | null = null;
  private plot: Record<string, unknown> | null = null;
  private character: Record<string, unknown> = {};
  private plotList: Array<Record<string, unknown>> = [];
  private knowledgeList: Array<Record<string, unknown>> = [];
  private elementList: Array<Record<string, unknown>> = [];
  private currentPlot: Record<string, unknown> | null = null;
  private messageList: Array<Record<string, unknown>> = [];
  private itemList = '';
  private showImageList: string[] = [];
  private userRemainConfig: Array<{ times: number; moduleId: number }> = [];
  private pendingRollMetrics: Record<string, unknown> | null = null;

  constructor(
    private readonly connection: any,
    private readonly playService: PlayService,
    private readonly gptService: GptService,
    private readonly storageService: MinioStorageService,
    private readonly db: LegacyDbService,
  ) {}

  bind() {
    this.connection.on('text', async (text: string) => {
      try {
        const payload = JSON.parse(text) as Record<string, unknown>;
        await this.handleMessage(payload);
      } catch {
        return;
      }
    });

    this.connection.on('close', async () => {
      await this.saveGame();
    });

    this.connection.on('error', async () => {
      await this.saveGame();
    });
  }

  private async handleMessage(message: Record<string, unknown>) {
    switch (message.func) {
      case 'connect':
        await this.handleConnect(String(message.gameId ?? ''));
        return;
      case 'heartBeats':
        this.connection.send(JSON.stringify({ func: 'heartBeats' }));
        return;
      case 'chat':
        await this.handleChat(String(message.message ?? ''), Number(message.moduleId ?? 1), message);
        return;
      case 'quitGame':
        await this.saveGame();
        return;
      default:
        return;
    }
  }

  private async handleConnect(gameId: string) {
    this.gameId = gameId;
    const { game, plot, character, plotList, elementList, knowledge } =
      await this.playService.queryGameConfig(gameId);

    this.game = game;
    this.plot = plot;
    this.plotList = plotList as Array<Record<string, unknown>>;
    this.elementList = elementList as Array<Record<string, unknown>>;
    this.knowledgeList = knowledge as Array<Record<string, unknown>>;
    this.userId = String(game?.creator ?? '');
    this.itemList = String(game?.currentItems ?? '');
    this.showImageList = String(game?.image_list ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    this.userRemainConfig = await this.playService.queryRemainTimes(this.userId);
    this.character = {
      ...(character as Record<string, unknown>),
      info: JSON.parse(String((character as Record<string, unknown>)?.info ?? '{}')),
    };

    this.currentPlot = plot as Record<string, unknown>;
    for (const item of this.plotList) {
      if (String(item.uuid ?? '') === String(game?.currentPlotId ?? '')) {
        this.currentPlot = item;
        break;
      }
    }

    await this.loadHistoryMessage();
  }

  private async handleChat(action: string, moduleId: number, rawMessage: Record<string, unknown>) {
    const enabled = this.consumeLimit(moduleId);
    if (!enabled) {
      await this.sendMessage(
        {
          func: 'chat',
          message: '您的该模型已超过今天的使用上限，请切换模型。',
          character: 'system',
        },
        false,
      );
      return;
    }

    this.messageList.push(rawMessage);
    await this.pushKnowledgeImages(action);

    const message = await this.generateMessage(action, moduleId);
    await this.sendMessage({ func: 'chat', message, character: 'system' });
    await this.sendMessage({ func: 'items', items: this.itemList });

    if (Number(this.currentPlot?.plotType ?? 0) === 2) {
      await this.sendMessage({ func: 'finish' });
      await this.playService.markFinished(this.gameId);
    }

    if (this.pendingRollMetrics) {
      await this.rollMetrics();
    }

    await this.saveGame();
  }

  private consumeLimit(moduleId: number) {
    let enabled = true;
    this.userRemainConfig = this.userRemainConfig.map((item) => {
      if (item.moduleId !== moduleId) {
        return item;
      }

      const nextTimes = Math.max(item.times - 1, 0);
      enabled = nextTimes > 0;
      return {
        ...item,
        times: nextTimes,
      };
    });
    return enabled;
  }

  private async loadHistoryMessage() {
    const path = `/messageHistory/${this.gameId}`;
    const history = await this.storageService.tryReadJson<Array<Record<string, unknown>>>(path);
    if (!history) {
      const welcome = {
        func: 'chat',
        message: `欢迎进入${String(this.plot?.title ?? '')}的世界，您将扮演${String((this.character.info as Record<string, unknown>)?.name ?? '')}，祝您旅途愉快。`,
        character: 'system',
      };
      this.findFirstPlot();
      await this.sendMessage(welcome);
      return;
    }

    this.messageList = history;
    if (this.messageList.length === 1) {
      this.findFirstPlot();
    }
    const url = await this.storageService.getPresignedUrl(path);
    this.connection.send(JSON.stringify({ func: 'history', url }));
  }

  private async saveGame() {
    if (!this.gameId || !this.userId || !this.currentPlot) {
      return;
    }

    await this.storageService.saveJson(`/messageHistory/${this.gameId}`, this.messageList);
    await this.playService.saveRuntimeState(
      this.gameId,
      String(this.currentPlot.uuid ?? this.plot?.uuid ?? ''),
      this.itemList,
      this.showImageList,
      this.userId,
      this.userRemainConfig,
    );
  }

  private async sendMessage(message: Record<string, unknown>, appendToHistory = true) {
    if (appendToHistory) {
      this.messageList.push(message);
    }

    if (message.func === 'chat') {
      await this.pushCurrentPlotImages();
      await this.pushKnowledgeImages(String(message.message ?? ''));
      await this.storageService.saveJson(`/messageHistory/${this.gameId}`, this.messageList);
    }

    this.connection.send(JSON.stringify(message));
  }

  private findFirstPlot() {
    const firstPlot =
      this.plotList.find((item) =>
        String(item.plotParent ?? '').includes(String(this.plot?.uuid ?? '')),
      ) ??
      ({
        uuid: this.plot?.uuid ?? '',
        title: '导入剧情',
        descript: '',
      } as Record<string, unknown>);

    this.currentPlot = firstPlot;
    this.sendMessage(
      {
        func: 'chat',
        message: `当前剧情为：${String(firstPlot.title ?? '')}，请开始您的操作。具体情况为：${String(firstPlot.descript ?? '')}`,
        character: 'system',
      },
      true,
    );
  }

  private async pushCurrentPlotImages() {
    const currentPlotId = String(this.currentPlot?.uuid ?? '');
    if (!currentPlotId || this.showImageList.includes(currentPlotId)) {
      return;
    }

    const images = String(this.currentPlot?.images ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    this.showImageList.push(currentPlotId);
    for (const url of images) {
      await this.sendMessage({ func: 'image', message: url, character: 'system' });
    }
  }

  private async pushKnowledgeImages(message: string) {
    const images: string[] = [];
    for (const item of this.knowledgeList) {
      const uuid = String(item.uuid ?? '');
      const name = String(item.name ?? '');
      if (name && message.includes(name) && !this.showImageList.includes(uuid)) {
        this.showImageList.push(uuid);
        images.push(
          ...String(item.images ?? '')
            .split(',')
            .map((url) => url.trim())
            .filter(Boolean),
        );
      }
    }

    for (const url of images) {
      await this.sendMessage({ func: 'image', message: url, character: 'system' });
    }
  }

  private async generateMessage(action: string, moduleId: number) {
    const plotConditions = this.plotList
      .filter((item) => String(item.plotParent ?? '').includes(String(this.currentPlot?.uuid ?? '')))
      .map((item) => ({
        name: String(item.title ?? ''),
        descript: String(item.descript ?? ''),
        plotType: Number(item.plotType ?? 0),
        condition: this.elementList
          .filter((element) =>
            String(item.conditionIds ?? '')
              .split(',')
              .map((id) => id.trim())
              .filter(Boolean)
              .includes(String(element.uuid ?? '')),
          )
          .map((element) => `${String(element.name ?? '')}:${String(element.descript ?? '')}`),
      }));

    const previousSystemMessage =
      [...this.messageList]
        .reverse()
        .find((item) => item.func === 'chat' && item.character === 'system')?.message ?? '无';

    const plotInfo = `剧情名称：${String(this.plot?.title ?? '')}，剧情世界观类型：${formatWorldTypes(
      String(this.plot?.worldType ?? ''),
    )}\n世界观信息：${formatKnowledge(this.knowledgeList)}`;
    const prompt = createPlayPrompt(
      plotInfo,
      plotConditions,
      String(previousSystemMessage),
      action,
      this.itemList,
      this.character,
    );
    const raw = await this.gptService.generateStructuredMessage(prompt, moduleId);
    if (!raw) {
      return '生成剧情失败，请重新输入您的行动';
    }

    const parsed = JSON.parse(raw) as {
      message?: string;
      nextPlot?: string;
      values?: string[];
    };

    if (parsed.nextPlot) {
      const matched = this.plotList.find((item) => parsed.nextPlot?.startsWith(String(item.title ?? '')));
      if (matched) {
        this.currentPlot = matched;
        if (matched.metrics) {
          try {
            this.pendingRollMetrics = JSON.parse(String(matched.metrics));
          } catch {
            this.pendingRollMetrics = null;
          }
        }
      }
    }

    if (Array.isArray(parsed.values)) {
      this.itemList = parsed.values.join(',');
    }

    return String(parsed.message ?? '').replaceAll(',', '，');
  }

  private async rollMetrics() {
    const metricsRule = this.pendingRollMetrics;
    this.pendingRollMetrics = null;
    if (!metricsRule) {
      return;
    }

    let targetKey = '';
    let targetValue = 0;
    for (const [key, value] of Object.entries(metricsRule)) {
      if (key !== 'limit') {
        targetKey = key;
        targetValue = Number(value);
        break;
      }
    }

    if (!targetKey) {
      return;
    }

    const metricsType = await this.db.findFirst<{ detail: string }>(
      'select * from numerical_value_table where inUsed = ?',
      [1],
    );
    const metricsArray = JSON.parse(metricsType?.detail ?? '[]') as Array<Record<string, unknown>>;
    const metricsInfo = metricsArray.find((item) => String(item.key_name ?? '') === targetKey) ?? null;
    const characterMetrics = JSON.parse(String(this.character.metrics ?? '{}')) as Record<string, number>;
    const max = characterMetrics[targetKey] ?? targetValue * 2;
    const rollData = Math.floor(Math.random() * (max + 1));

    await this.sendMessage({
      func: 'roll',
      data: {
        rollData,
        targetData: targetValue,
        type: targetKey,
        metricsInfo,
      },
    });

    if (rollData <= targetValue) {
      const nextSubPlot = this.plotList.find(
        (item) => String(item.subParentId ?? '') === String(this.currentPlot?.uuid ?? ''),
      );
      if (nextSubPlot) {
        this.currentPlot = nextSubPlot;
      }
    }
  }
}
