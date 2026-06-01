import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ProxyAgent, fetch as undiciFetch } from 'undici';

import { getModuleNameById } from '../../common/utils/legacy.constants';

const proxyAgent = new ProxyAgent('http://127.0.0.1:7897');

@Injectable()
export class GptService {
  private static readonly OPENAI_TIMEOUT_MS = 30 * 1000;

  private readonly openai: OpenAI;
  private readonly deepseek: OpenAI;
  private readonly bedrockClient: BedrockRuntimeClient;
  private readonly logger = new Logger(GptService.name);
  private readonly openaiApiKey: string;
  private readonly deepseekApiKey: string;
  private readonly defaultLlmModel: string;
  private readonly bedrockModelId: string;
  private readonly bedrockAccessKeyId: string;
  private readonly bedrockSecretAccessKey: string;

  constructor(private readonly configService: ConfigService) {
    this.defaultLlmModel = this.configService.get<string>('app.defaultLlmModel', 'deepseek-v4-pro');
    this.openaiApiKey = this.configService.get<string>('app.openaiApiKey', '').trim();
    this.deepseekApiKey = this.configService.get<string>('app.deepseekApiKey', '').trim();
    this.bedrockModelId = this.configService.get<string>('app.bedrockModelId', '');
    this.bedrockAccessKeyId = this.configService.get<string>('app.bedrockAccessKeyId', '');
    this.bedrockSecretAccessKey = this.configService.get<string>('app.bedrockSecretAccessKey', '');

    this.openai = this.createOpenAiCompatibleClient(
      this.openaiApiKey,
      this.configService.get<string>('app.openaiBaseUrl') || undefined,
    );
    this.deepseek = this.createOpenAiCompatibleClient(
      this.deepseekApiKey,
      this.configService.get<string>('app.deepseekBaseUrl', 'https://api.deepseek.com'),
    );

    this.bedrockClient = new BedrockRuntimeClient({
      region: this.configService.get<string>('app.bedrockRegion', 'us-west-2'),
      credentials: {
        accessKeyId: this.bedrockAccessKeyId,
        secretAccessKey: this.bedrockSecretAccessKey,
      },
    });
  }

  async generateDirectMessage(message: string, model?: string) {
    const resolvedModel = this.resolveModel(model);
    if (!this.isChatProviderConfigured(resolvedModel)) {
      this.logger.error(
        `${this.getProviderName(resolvedModel)} generation skipped for model=${resolvedModel} because API key is empty`,
      );
      return '';
    }

    try {
      const result = await this.createChatCompletion(message, resolvedModel);
      return this.unwrapJsonFence(result);
    } catch (error) {
      this.logger.error(
        `${this.getProviderName(resolvedModel)} generation failed for model=${resolvedModel}: ${this.formatOpenAiError(error)}`,
        error instanceof Error ? error.stack : String(error),
      );
      return '';
    }
  }

  async generateStructuredMessage(message: string, moduleId = 1) {
    const model = this.resolveStructuredModel(moduleId);

    if (model === 'Claude' && !this.isBedrockConfigured()) {
      this.logger.warn(
        `Skipping Claude request for moduleId=${moduleId} because Bedrock credentials are not configured`,
      );
      return null;
    }

    if (model !== 'Claude' && !this.isChatProviderConfigured(model)) {
      this.logger.warn(
        `Skipping ${this.getProviderName(model)} request for moduleId=${moduleId} model=${model} because API key is empty`,
      );
      return null;
    }

    this.logger.log(
      `Structured generation started for moduleId=${moduleId} model=${model} promptLength=${message.length}`,
    );

    for (let retry = 0; retry < 3; retry += 1) {
      const startedAt = Date.now();
      let text = '';
      try {
        text = model === 'Claude'
          ? await this.invokeClaude(message)
          : await this.generateStructuredChatMessage(message, model);
      } catch (error) {
        this.logger.error(
          `Structured generation failed for moduleId=${moduleId} model=${model} retry=${retry + 1}`,
          error instanceof Error ? error.stack : String(error),
        );
        continue;
      }

      this.logger.log(
        `Structured generation response for moduleId=${moduleId} model=${model} retry=${retry + 1} durationMs=${Date.now() - startedAt} outputLength=${text.length}`,
      );

      const normalized = this.extractJsonObject(text) ?? text.replaceAll('，', ',');
      try {
        JSON.parse(normalized);
        return normalized;
      } catch {
        this.logger.warn(
          `Structured generation returned non-JSON output for moduleId=${moduleId} model=${model} retry=${retry + 1} output=${this.previewText(text)}`,
        );
        continue;
      }
    }

    return null;
  }

  async generateAutoCharacter(prompt: string) {
    const endpoint = this.configService.get<string>('app.legacyAutoGptEndpoint', '');
    if (endpoint) {
      const response = await fetch(`${endpoint}?message=${encodeURIComponent(prompt)}`);
      const payload = (await response.json()) as { message: string };
      return this.unwrapJsonFence(payload.message);
    }

    return this.generateDirectMessage(
      prompt,
      this.configService.get<string>('app.autoCharacterModel') || this.defaultLlmModel,
    );
  }

  private async invokeClaude(message: string) {
    const command = new InvokeModelCommand({
      modelId: this.configService.get<string>('app.bedrockModelId', ''),
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        temperature: 1,
        messages: [{ role: 'user', content: message }],
      }),
    });

    const response = await this.bedrockClient.send(command);
    const payload = JSON.parse(Buffer.from(response.body).toString('utf8')) as {
      content: Array<{ text: string }>;
    };
    return this.unwrapJsonFence(payload.content[0]?.text ?? '');
  }

  private async generateStructuredChatMessage(message: string, model: string) {
    if (!this.isChatProviderConfigured(model)) {
      this.logger.error(
        `${this.getProviderName(model)} structured generation skipped for model=${model} because API key is empty`,
      );
      return '';
    }

    try {
      return await this.createChatCompletion(message, model, true);
    } catch (error) {
      this.logger.warn(
        `${this.getProviderName(model)} structured JSON mode failed for model=${model}, falling back to plain chat completion: ${this.formatOpenAiError(error)}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    try {
      return await this.createChatCompletion(message, model);
    } catch (error) {
      this.logger.error(
        `${this.getProviderName(model)} structured fallback failed for model=${model}: ${this.formatOpenAiError(error)}`,
        error instanceof Error ? error.stack : String(error),
      );
      return '';
    }
  }

  private async createChatCompletion(
    message: string,
    model: string,
    jsonMode = false,
  ) {
    const provider = this.getProviderName(model);
    this.logger.log(
      `${provider} request started model=${model} jsonMode=${jsonMode} timeoutMs=${GptService.OPENAI_TIMEOUT_MS}`,
    );

    const startedAt = Date.now();
    try {
      const completion = await this.getChatClient(model).chat.completions.create(
        this.buildChatCompletionBody(message, model, jsonMode),
        {
          timeout: GptService.OPENAI_TIMEOUT_MS,
        },
      );

      this.logger.log(
        `${provider} request completed model=${model} jsonMode=${jsonMode} durationMs=${Date.now() - startedAt}`,
      );

      return completion.choices[0]?.message?.content ?? '';
    } catch (error) {
      this.logger.error(
        `${provider} request failed model=${model} jsonMode=${jsonMode} durationMs=${Date.now() - startedAt}: ${this.formatOpenAiError(error)}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private createOpenAiCompatibleClient(apiKey: string, baseURL?: string) {
    return new OpenAI({
      apiKey,
      baseURL,
      timeout: 30 * 1000,
      maxRetries: 0,
      fetch: async (url, init) => {
        return undiciFetch(url as any, {
          ...(init as any),
          // dispatcher: proxyAgent,
        } as any) as any;
      },
    });
  }

  private buildChatCompletionBody(message: string, model: string, jsonMode: boolean) {
    return {
      model,
      messages: [{ role: 'user' as const, content: message }],
      ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
      ...(this.isDeepSeekModel(model)
        ? {
            thinking: {
              type: this.configService.get<string>('app.deepseekThinkingType', 'enabled'),
            },
            reasoning_effort: this.configService.get<string>('app.deepseekReasoningEffort', 'high'),
          }
        : {}),
    } as any;
  }

  private resolveStructuredModel(moduleId: number) {
    const model = getModuleNameById(moduleId);
    return moduleId === 1 ? this.defaultLlmModel : model;
  }

  private resolveModel(model?: string) {
    return model?.trim() || this.defaultLlmModel;
  }

  private getChatClient(model: string) {
    return this.isDeepSeekModel(model) ? this.deepseek : this.openai;
  }

  private getProviderName(model: string) {
    return this.isDeepSeekModel(model) ? 'DeepSeek' : 'OpenAI';
  }

  private isDeepSeekModel(model: string) {
    return model.toLowerCase().startsWith('deepseek-');
  }

  private unwrapJsonFence(text: string) {
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fenced) {
      return fenced[1].trim();
    }

    return trimmed;
  }

  private extractJsonObject(text: string) {
    const unwrapped = this.unwrapJsonFence(text);
    try {
      JSON.parse(unwrapped);
      return unwrapped;
    } catch {
      // Continue and try to extract the first balanced top-level object.
    }

    const start = unwrapped.indexOf('{');
    const end = unwrapped.lastIndexOf('}');
    if (start < 0 || end <= start) {
      return null;
    }

    const candidate = unwrapped.slice(start, end + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      return null;
    }
  }

  private previewText(text: string) {
    return JSON.stringify(String(text || '').slice(0, 240));
  }

  private isBedrockConfigured() {
    return Boolean(
      this.bedrockModelId &&
      this.bedrockAccessKeyId &&
      this.bedrockSecretAccessKey,
    );
  }

  private isOpenAiConfigured() {
    return Boolean(this.openaiApiKey);
  }

  private isDeepSeekConfigured() {
    return Boolean(this.deepseekApiKey);
  }

  private isChatProviderConfigured(model: string) {
    return this.isDeepSeekModel(model) ? this.isDeepSeekConfigured() : this.isOpenAiConfigured();
  }

  private formatOpenAiError(error: unknown) {
    if (!error || typeof error !== 'object') {
      return String(error);
    }

    const record = error as {
      status?: number;
      code?: string;
      type?: string;
      message?: string;
    };

    const detail = [
      record.status ? `status=${record.status}` : '',
      record.code ? `code=${record.code}` : '',
      record.type ? `type=${record.type}` : '',
      record.message ? `message=${record.message}` : '',
    ].filter(Boolean).join(' ');

    return detail || String(error);
  }
}
