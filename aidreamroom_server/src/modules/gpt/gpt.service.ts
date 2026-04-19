import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import { getModuleNameById } from '../../common/utils/legacy.constants';

@Injectable()
export class GptService {
  private readonly openai: OpenAI;
  private readonly bedrockClient: BedrockRuntimeClient;
  private readonly logger = new Logger(GptService.name);
  private readonly openaiApiKey: string;
  private readonly bedrockModelId: string;
  private readonly bedrockAccessKeyId: string;
  private readonly bedrockSecretAccessKey: string;

  constructor(private readonly configService: ConfigService) {
    this.openaiApiKey = this.configService.get<string>('app.openaiApiKey', '');
    this.bedrockModelId = this.configService.get<string>('app.bedrockModelId', '');
    this.bedrockAccessKeyId = this.configService.get<string>('app.bedrockAccessKeyId', '');
    this.bedrockSecretAccessKey = this.configService.get<string>('app.bedrockSecretAccessKey', '');

    this.openai = new OpenAI({
      apiKey: this.openaiApiKey,
      baseURL: this.configService.get<string>('app.openaiBaseUrl') || undefined,
    });

    this.bedrockClient = new BedrockRuntimeClient({
      region: this.configService.get<string>('app.bedrockRegion', 'us-west-2'),
      credentials: {
        accessKeyId: this.bedrockAccessKeyId,
        secretAccessKey: this.bedrockSecretAccessKey,
      },
    });
  }

  async generateDirectMessage(message: string, model = 'gpt-4o-mini') {
    const completion = await this.openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: message }],
    });

    const result = completion.choices[0]?.message?.content ?? '';
    return this.unwrapJsonFence(result);
  }

  async generateStructuredMessage(message: string, moduleId = 1) {
    const model = getModuleNameById(moduleId);

    if (model === 'Claude' && !this.isBedrockConfigured()) {
      this.logger.warn(
        `Skipping Claude request for moduleId=${moduleId} because Bedrock credentials are not configured`,
      );
      return null;
    }

    if (model !== 'Claude' && !this.openaiApiKey) {
      this.logger.warn(
        `Skipping OpenAI request for moduleId=${moduleId} model=${model} because OPENAI_API_KEY is empty`,
      );
      return null;
    }

    for (let retry = 0; retry < 3; retry += 1) {
      let text = '';
      try {
        text = model === 'Claude'
          ? await this.invokeClaude(message)
          : await this.generateDirectMessage(message, model);
      } catch (error) {
        this.logger.error(
          `Structured generation failed for moduleId=${moduleId} model=${model} retry=${retry + 1}`,
          error instanceof Error ? error.stack : String(error),
        );
        continue;
      }

      const normalized = text.replaceAll('，', ',');
      try {
        JSON.parse(normalized);
        return normalized;
      } catch {
        this.logger.warn(
          `Structured generation returned non-JSON output for moduleId=${moduleId} model=${model} retry=${retry + 1}`,
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
      this.configService.get<string>('app.autoCharacterModel', 'gpt-4o-mini'),
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

  private unwrapJsonFence(text: string) {
    if (text.startsWith('```json')) {
      return text.slice(7, -3).trim();
    }
    return text.trim();
  }

  private isBedrockConfigured() {
    return Boolean(
      this.bedrockModelId &&
      this.bedrockAccessKeyId &&
      this.bedrockSecretAccessKey,
    );
  }
}
