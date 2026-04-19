import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GptService } from '../../gpt/gpt.service';
import { PlayService } from '../play.service';
import {
  appendGameEvent,
  applyRuleResult,
  buildClientSnapshot,
  buildNarrationPrompt,
  executeRule,
  normalizeNarrationOutput,
  parseIntent,
} from '../runtime/play-runtime.util';
import {
  NarrationOutput,
  PlayCharacterProfile,
  PlayGameState,
  PlayMessageRecord,
  PlayScriptBundle,
  PlayScriptRecord,
} from '../runtime/play-runtime.types';

const websocket = require('nodejs-websocket');

function formatRemoteAddress(connection: any) {
  const address = connection?.socket?.remoteAddress ?? 'unknown';
  const port = connection?.socket?.remotePort;
  return port ? `${address}:${port}` : address;
}

function summarizeIncomingMessage(message: Record<string, unknown>) {
  const summary: Record<string, unknown> = {
    func: String(message.func ?? 'unknown'),
  };

  if (message.gameId) {
    summary.gameId = String(message.gameId);
  }

  if (message.moduleId !== undefined) {
    summary.moduleId = Number(message.moduleId);
  }

  if (typeof message.message === 'string') {
    summary.messageLength = message.message.length;
  }

  return JSON.stringify(summary);
}

@Injectable()
export class PlaySocketService implements OnModuleInit, OnModuleDestroy {
  private server: any;
  private readonly logger = new Logger(PlaySocketService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly playService: PlayService,
    private readonly gptService: GptService,
  ) {}

  onModuleInit() {
    const port = this.configService.get<number>('app.legacyWsPort', 3300);
    this.logger.log(`Starting legacy websocket server on port ${port}`);
    this.server = websocket.createServer((connection: any) => {
      const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      this.logger.log(
        `[${sessionId}] accepted websocket connection from ${formatRemoteAddress(connection)}`,
      );
      const session = new GameSocketSession(
        connection,
        this.logger,
        sessionId,
        this.playService,
        this.gptService,
      );
      session.bind();
    });
    this.server.listen(port);
    this.logger.log(`Legacy websocket server is listening on port ${port}`);
  }

  onModuleDestroy() {
    if (this.server?.close) {
      this.logger.log('Shutting down legacy websocket server');
      this.server.close();
    }
  }
}

class GameSocketSession {
  private gameId = '';
  private userId = '';
  private scriptId = '';
  private bundle: PlayScriptBundle | null = null;
  private script: PlayScriptRecord | null = null;
  private state: PlayGameState | null = null;
  private character: PlayCharacterProfile | null = null;
  private messages: PlayMessageRecord[] = [];
  private userRemainConfig: Array<{ times: number; moduleId: number }> = [];

  constructor(
    private readonly connection: any,
    private readonly logger: Logger,
    private readonly sessionId: string,
    private readonly playService: PlayService,
    private readonly gptService: GptService,
  ) {}

  bind() {
    this.connection.on('text', async (text: string) => {
      try {
        const payload = JSON.parse(text) as Record<string, unknown>;
        this.logger.log(`[${this.sessionId}] received ${summarizeIncomingMessage(payload)}`);
        await this.handleMessage(payload);
      } catch (error) {
        this.logger.error(
          `[${this.sessionId}] failed to process websocket payload from ${formatRemoteAddress(this.connection)}`,
          error instanceof Error ? error.stack : String(error),
        );
        this.sendPayload({
          func: 'error',
          message: '消息格式错误',
        });
      }
    });

    this.connection.on('close', async (code?: number, reason?: string) => {
      this.logger.log(
        `[${this.sessionId}] websocket closed code=${code ?? 'unknown'} reason=${reason || 'n/a'}`,
      );
      await this.saveGame();
    });

    this.connection.on('error', async (error: unknown) => {
      this.logger.error(
        `[${this.sessionId}] websocket error for gameId=${this.gameId || 'unknown'}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.saveGame();
    });
  }

  private async handleMessage(message: Record<string, unknown>) {
    switch (message.func) {
      case 'connect':
        await this.handleConnect(String(message.gameId ?? ''));
        return;
      case 'heartBeats':
        this.sendPayload({ func: 'heartBeats' });
        return;
      case 'chat':
        await this.handleChat(String(message.message ?? ''), Number(message.moduleId ?? 1));
        return;
      case 'quitGame':
        await this.saveGame();
        return;
      default:
        this.logger.warn(
          `[${this.sessionId}] received unsupported websocket func=${String(message.func ?? 'unknown')}`,
        );
        return;
    }
  }

  private async handleConnect(gameId: string) {
    this.gameId = gameId;
    this.logger.log(`[${this.sessionId}] initializing websocket session for gameId=${gameId}`);
    const session = await this.playService.loadStructuredSession(gameId);

    if (!session) {
      this.logger.warn(`[${this.sessionId}] no structured session found for gameId=${gameId}`);
      this.sendPayload({
        func: 'error',
        message: '当前会话不存在，或仍是旧版游玩会话。',
      });
      return;
    }

    this.userId = String(session.game.creator ?? '');
    this.scriptId = session.script.uuid;
    this.bundle = session.bundle;
    this.script = session.script;
    this.state = session.state;
    this.character = session.character;
    this.messages = session.messages;
    this.userRemainConfig = await this.playService.queryRemainTimes(this.userId);
    this.logger.log(
      `[${this.sessionId}] websocket session ready gameId=${this.gameId} userId=${this.userId} history=${this.messages.length}`,
    );

    this.sendPayload({
      func: 'history',
      messages: this.messages,
    });
    await this.sendState();
  }

  private async handleChat(action: string, moduleId: number) {
    if (!this.bundle || !this.state || !this.character || !this.script) {
      this.logger.warn(
        `[${this.sessionId}] received chat before session initialization gameId=${this.gameId || 'unknown'}`,
      );
      this.sendPayload({
        func: 'error',
        message: '游玩会话尚未初始化。',
      });
      return;
    }

    const playerInput = action.trim();
    if (!playerInput) {
      return;
    }

    this.logger.log(
      `[${this.sessionId}] handling chat gameId=${this.gameId} moduleId=${moduleId} messageLength=${playerInput.length}`,
    );

    if (this.state.status === 'finished') {
      this.logger.log(`[${this.sessionId}] game already finished for gameId=${this.gameId}`);
      this.sendPayload({
        func: 'finish',
      });
      return;
    }

    const enabled = this.consumeLimit(moduleId);
    if (!enabled) {
      this.logger.warn(
        `[${this.sessionId}] module limit exhausted for gameId=${this.gameId} moduleId=${moduleId}`,
      );
      this.sendPayload({
        func: 'chat',
        message: '您的该模型已超过今天的使用上限，请切换模型。',
        character: 'system',
      });
      await this.sendState();
      return;
    }

    const playerMessage: PlayMessageRecord = {
      func: 'chat',
      message: playerInput,
      character: 'me',
    };
    this.messages.push(playerMessage);

    const intent = parseIntent(playerInput, this.bundle);
    const ruleResult = executeRule(
      playerInput,
      intent,
      this.state,
      this.bundle,
      this.character,
    );
    const nextState = applyRuleResult(this.state, ruleResult, this.bundle);
    appendGameEvent(nextState, playerInput, ruleResult);

    const prompt = buildNarrationPrompt({
      bundle: this.bundle,
      state: nextState,
      intent,
      ruleResult,
      playerInput,
      character: this.character,
    });
    const llmRaw = await this.gptService.generateStructuredMessage(prompt, moduleId);
    const narration = normalizeNarrationOutput(llmRaw);

    if (!narration || (!narration.narration && narration.npc_dialogues.length === 0)) {
      this.refundLimit(moduleId);
      this.logger.warn(
        `[${this.sessionId}] AI narration unavailable gameId=${this.gameId} moduleId=${moduleId}; turn was not advanced`,
      );
      this.messages = this.messages.filter((item) => item !== playerMessage);
      this.sendPayload({
        func: 'error',
        message: 'AI 生成失败，请检查模型配置或稍后重试。',
        refundModuleId: moduleId,
      });
      await this.sendState();
      return;
    }

    this.state = nextState;
    await this.emitTurn(narration);
    await this.playService.saveTurnLog({
      gameId: this.gameId,
      turn: nextState.turnCount,
      playerInput,
      parsedIntent: intent,
      ruleResult,
      llmOutput: narration,
    });
    await this.saveGame();
    this.logger.log(
      `[${this.sessionId}] completed turn gameId=${this.gameId} turn=${nextState.turnCount} status=${nextState.status}`,
    );
  }

  private consumeLimit(moduleId: number) {
    let enabled = false;
    this.userRemainConfig = this.userRemainConfig.map((item) => {
      if (item.moduleId !== moduleId) {
        return item;
      }

      if (item.times <= 0) {
        enabled = false;
        return item;
      }

      enabled = true;
      return {
        ...item,
        times: Math.max(item.times - 1, 0),
      };
    });

    return enabled;
  }

  private refundLimit(moduleId: number) {
    this.userRemainConfig = this.userRemainConfig.map((item) => {
      if (item.moduleId !== moduleId) {
        return item;
      }

      return {
        ...item,
        times: item.times + 1,
      };
    });
  }

  private async emitTurn(narration: NarrationOutput) {
    if (narration.narration) {
      await this.sendChat({
        func: 'chat',
        message: narration.narration,
        character: 'narrator',
        speaker: '艾达 AIDR（叙述者）',
      });
    }

    for (const dialogue of narration.npc_dialogues) {
      const npcName =
        this.bundle?.npcsById[dialogue.npcId]?.name ?? dialogue.npcId;
      await this.sendChat({
        func: 'chat',
        message: dialogue.text,
        character: dialogue.npcId,
        speaker: npcName,
      });
    }

    await this.sendState();

    if (this.state?.status === 'finished') {
      this.sendPayload({ func: 'finish' });
      await this.playService.markFinished(this.gameId);
    }
  }

  private async sendState() {
    if (!this.bundle || !this.state || !this.character) {
      return;
    }

    const snapshot = buildClientSnapshot(this.bundle, this.state, this.character);
    this.sendPayload({
      func: 'state',
      state: snapshot,
    });
    this.sendPayload({
      func: 'items',
      items: snapshot.inventoryLabels.join(','),
    });
  }

  private async sendChat(message: PlayMessageRecord) {
    this.messages.push(message);
    this.sendPayload(message);
  }

  private sendPayload(payload: Record<string, unknown>) {
    this.connection.send(JSON.stringify(payload));
  }

  private async saveGame() {
    if (!this.gameId || !this.userId || !this.state || !this.scriptId) {
      return;
    }

    await this.playService.saveScriptRuntime({
      gameId: this.gameId,
      scriptId: this.scriptId,
      state: this.state,
      messages: this.messages,
      userId: this.userId,
      limitConfig: this.userRemainConfig,
    });
    this.logger.log(
      `[${this.sessionId}] saved runtime gameId=${this.gameId} turn=${this.state.turnCount} messages=${this.messages.length}`,
    );
  }
}
