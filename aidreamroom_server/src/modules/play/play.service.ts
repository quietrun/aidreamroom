import { Injectable, OnModuleInit } from '@nestjs/common';

import { LegacyDbService } from '../../common/database/legacy-db.service';
import {
  DEFAULT_LIMIT_CONFIG,
  MODULE_LIST,
} from '../../common/utils/legacy.constants';
import { generateUuid } from '../../common/utils/id.util';
import { normalizeTimestamp } from '../../common/utils/number.util';
import { ScriptsService } from '../scripts/scripts.service';
import {
  buildClientSnapshot,
  buildWelcomeMessages,
  createInitialGameState,
  parseScriptBundle,
} from './runtime/play-runtime.util';
import {
  PlayCharacterProfile,
  PlayGameState,
  PlayMessageRecord,
  PlayScriptRecord,
  RuntimeRow,
} from './runtime/play-runtime.types';

type CreatePlayPayload = {
  script_id?: string;
  model_id?: number;
  currentItems?: string[];
};

type PlayConfigRow = {
  uuid: string;
  creator: string;
  updateTime: number | bigint | null;
  plot_id: string | null;
  character_id: string | null;
  currentPlotId: string | null;
  model_id: number | null;
  currentItems: string | null;
  image_list: string | null;
  isFinish: boolean | null;
};

type UserRoleRow = {
  uuid: string;
  name: string;
  gender: string | null;
  age: number | null;
  strength: number | null;
  constitution: number | null;
  size: number | null;
  dexterity: number | null;
  appearance: number | null;
  intelligence: number | null;
  power: number | null;
  education: number | null;
  luck: number | null;
  items: string | null;
  worlds: string | null;
};

type LatestGameRow = {
  uuid: string;
  creator: string;
  updateTime: number | bigint | null;
  plot_id: string | null;
  character_id: string | null;
  currentPlotId: string | null;
  model_id: number | null;
  currentItems: string | null;
  image_list: string | null;
  isFinish: boolean | number | null;
  latest_plot_title: string | null;
  latest_plot_description: string | null;
  latest_plot_theme: string | null;
  latest_total_nodes: number | null;
  latest_objectives: string | null;
  progress_percent: number | null;
  turn_count: number | null;
  latest_plot_updateTime: number | bigint | null;
};

@Injectable()
export class PlayService implements OnModuleInit {
  private tableReady: Promise<void> | null = null;

  constructor(
    private readonly db: LegacyDbService,
    private readonly scriptsService: ScriptsService,
  ) {}

  async onModuleInit() {
    await this.ensureRuntimeTables();
  }

  async create(creatorId: string, payload: CreatePlayPayload) {
    await this.ensureRuntimeTables();

    const script = await this.resolveScriptForCreate(payload);
    if (!script) {
      return null;
    }

    const bundle = parseScriptBundle(script);
    const loadoutLabels = this.normalizeLoadoutLabels(payload.currentItems);
    const sessionId = generateUuid();
    const state = createInitialGameState(sessionId, bundle, loadoutLabels);
    const welcomeMessages = buildWelcomeMessages(bundle, state);

    const info = {
      uuid: sessionId,
      creator: creatorId,
      updateTime: normalizeTimestamp(),
      plot_id: script.uuid,
      character_id: '',
      currentPlotId: state.currentNodeId,
      model_id: payload.model_id ?? 1,
      currentItems: loadoutLabels.join(','),
      image_list: '',
      isFinish: false,
    };

    await this.db.replaceInto('play_config', info);
    await this.saveScriptRuntime({
      gameId: sessionId,
      scriptId: script.uuid,
      state,
      messages: welcomeMessages,
      userId: creatorId,
      limitConfig: null,
      scriptSummary: {
        title: script.metadata.title,
        description: script.metadata.description,
        theme: script.metadata.theme,
        totalNodes: script.metadata.totalEvents || script.metadata.totalNodes,
        updateTime: script.updateTime ?? normalizeTimestamp(),
      },
    });

    return {
      ...info,
      script_id: script.uuid,
      mode: 'script',
    };
  }

  async latestGame(creatorId: string) {
    await this.ensureRuntimeTables();

    const rows = await this.db.query<LatestGameRow>(
      `
        select uuid, creator, updateTime, plot_id, character_id, currentPlotId,
               model_id, currentItems, image_list, isFinish,
               latest_plot_title, latest_plot_description, latest_plot_theme,
               latest_total_nodes, latest_objectives, progress_percent,
               turn_count, latest_plot_updateTime
        from play_config
        where creator = ?
        order by updateTime desc
        limit 1
      `,
      [creatorId],
    );

    const row = rows[0];
    if (!row) {
      return {
        result: -1,
      };
    }

    const isFinish = Boolean(row.isFinish);
    const progressPercent = isFinish ? 100 : row.progress_percent;
    const scriptId = row.plot_id || '';

    return {
      result: 0,
      game: {
        uuid: row.uuid,
        creator: row.creator,
        updateTime: this.normalizeTimestampValue(row.updateTime),
        plot_id: scriptId,
        script_id: scriptId,
        character_id: row.character_id ?? '',
        currentPlotId: row.currentPlotId ?? '',
        model_id: row.model_id ?? 1,
        currentItems: row.currentItems ?? '',
        image_list: row.image_list ?? '',
        isFinish,
        mode: 'script',
        progressPercent,
        progress: progressPercent,
        turnCount: Number(row.turn_count ?? 0),
      },
      plot: {
        uuid: scriptId,
        title: row.latest_plot_title ?? '',
        descript: row.latest_plot_description ?? '',
        plotTarget: row.latest_objectives ?? '',
        worldType: row.latest_plot_theme ?? '',
        updateTime: this.normalizeTimestampValue(row.latest_plot_updateTime),
        type: row.latest_plot_theme ?? '',
      },
      script: {
        uuid: scriptId,
        metadata: {
          title: row.latest_plot_title ?? '',
          description: row.latest_plot_description ?? '',
          totalNodes: Number(row.latest_total_nodes ?? 0),
          totalEvents: Number(row.latest_total_nodes ?? 0),
          theme: row.latest_plot_theme ?? '',
        },
      },
      character: this.buildCharacterResponse({
        id: '',
        name: 'Traveler',
        image: '',
        info: { name: '' },
        metrics: {} as Record<string, number>,
      }),
    };
  }

  async queryGameConfig(id: string) {
    await this.ensureRuntimeTables();
    const game = await this.db.findFirst<PlayConfigRow>(
      'select * from play_config where uuid = ? limit 1',
      [id],
    );
    if (!game) {
      return {
        game: null,
        plot: null,
        script: null,
        character: null,
        runtime: null,
      };
    }

    const structured = await this.loadStructuredSession(id, game);
    if (!structured) {
      return {
        game,
        plot: null,
        script: null,
        character: null,
        runtime: null,
      };
    }

    const { script, state, messages, character } = structured;
    const snapshot = buildClientSnapshot(structured.bundle, state, character);

    return {
      game: this.buildStructuredGame(game, state, script, snapshot),
      plot: this.buildStructuredPlot(script, snapshot),
      script,
      character: this.buildCharacterResponse(character),
      runtime: {
        state,
        snapshot,
        messages,
      },
    };
  }

  async queryRemainTimes(userId: string) {
    const current = await this.db.findFirst<{ update_date: number; limit_config: string }>(
      'select * from chat_limit_table where user_id = ?',
      [userId],
    );
    let config = DEFAULT_LIMIT_CONFIG.map((item) => ({ ...item }));

    if (current) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      const currentDayStart = date.getTime();
      if (currentDayStart > Number(current.update_date ?? 0)) {
        await this.db.replaceInto('chat_limit_table', {
          user_id: userId,
          update_date: normalizeTimestamp(),
          limit_config: JSON.stringify(config),
        });
      } else {
        config = JSON.parse(current.limit_config ?? '[]') as Array<{
          times: number;
          moduleId: number;
        }>;
      }
    } else {
      await this.db.replaceInto('chat_limit_table', {
        user_id: userId,
        update_date: normalizeTimestamp(),
        limit_config: JSON.stringify(config),
      });
    }

    return config;
  }

  queryModuleList() {
    return MODULE_LIST;
  }

  async queryHistory(creatorId: string) {
    const games = await this.db.query<PlayConfigRow>(
      'select * from play_config where creator = ? order by updateTime desc',
      [creatorId],
    );
    const result: Array<Record<string, unknown>> = [];

    for (const game of games) {
      const structured = await this.loadStructuredSession(game.uuid, game);
      if (!structured) {
        continue;
      }

      const snapshot = buildClientSnapshot(
        structured.bundle,
        structured.state,
        structured.character,
      );

      result.push({
        gameId: game.uuid,
        plot: this.buildStructuredPlot(structured.script, snapshot),
        script: structured.script,
        character: this.buildCharacterResponse(structured.character),
        runtime: {
          snapshot,
          status: structured.state.status,
        },
      });
    }

    return result;
  }

  async loadStructuredSession(gameId: string, gameRow?: PlayConfigRow) {
    await this.ensureRuntimeTables();
    const game =
      gameRow ??
      (await this.db.findFirst<PlayConfigRow>(
        'select * from play_config where uuid = ? limit 1',
        [gameId],
      ));
    if (!game) {
      return null;
    }

    const runtime = await this.db.findFirst<RuntimeRow>(
      'select * from play_runtime_table where session_id = ? limit 1',
      [gameId],
    );
    const scriptId = runtime?.script_id || String(game.plot_id ?? '');
    if (!scriptId) {
      return null;
    }

    const script = (await this.scriptsService.queryByUuid(scriptId)) as
      | PlayScriptRecord
      | null;
    if (!script) {
      return null;
    }

    const bundle = parseScriptBundle(script);
    let state: PlayGameState;
    let messages: PlayMessageRecord[];

    if (!runtime) {
      state = createInitialGameState(
        gameId,
        bundle,
        this.normalizeLoadoutLabels(this.parseCommaList(game.currentItems)),
      );
      messages = buildWelcomeMessages(bundle, state);
      await this.saveScriptRuntime({
        gameId,
        scriptId,
        state,
        messages,
        userId: String(game.creator ?? ''),
        limitConfig: null,
        scriptSummary: {
          title: script.metadata.title,
          description: script.metadata.description,
          theme: script.metadata.theme,
          totalNodes: script.metadata.totalEvents || script.metadata.totalNodes,
          updateTime: script.updateTime ?? normalizeTimestamp(),
        },
      });
    } else {
      state = JSON.parse(runtime.state_json) as PlayGameState;
      messages = this.parseJson(runtime.message_log_json, []);
    }

    const character = await this.loadCharacterProfile(String(game.creator ?? ''));

    return {
      game,
      script,
      bundle,
      state,
      messages,
      character,
    };
  }

  async saveScriptRuntime(params: {
    gameId: string;
    scriptId: string;
    state: PlayGameState;
    messages: PlayMessageRecord[];
    userId: string;
    limitConfig: Array<{ times: number; moduleId: number }> | null;
    scriptSummary?: {
      title: string;
      description: string;
      theme: string;
      totalNodes: number;
      updateTime: number;
    };
  }) {
    const { gameId, scriptId, state, messages, userId, limitConfig, scriptSummary } = params;
    await this.ensureRuntimeTables();

    await this.db.replaceInto('play_runtime_table', {
      session_id: gameId,
      script_id: scriptId,
      state_json: JSON.stringify(state),
      message_log_json: JSON.stringify(messages),
      created_at: normalizeTimestamp(),
      updated_at: normalizeTimestamp(),
    });

    await this.db.execute(
      `
        update play_config
        set currentPlotId = ?,
            currentItems = ?,
            updateTime = ?,
            isFinish = ?,
            progress_percent = ?,
            turn_count = ?,
            latest_objectives = ?,
            latest_plot_title = coalesce(?, latest_plot_title),
            latest_plot_description = coalesce(?, latest_plot_description),
            latest_plot_theme = coalesce(?, latest_plot_theme),
            latest_total_nodes = coalesce(?, latest_total_nodes),
            latest_plot_updateTime = coalesce(?, latest_plot_updateTime)
        where uuid = ?
      `,
      [
        state.currentNodeId,
        messages.length > 0
          ? state.loadoutLabels.concat(this.stringifyInventoryLabels(state)).join(',')
          : this.stringifyInventoryLabels(state).join(','),
        normalizeTimestamp(),
        state.status === 'finished',
        this.calculateProgressPercent(
          state,
          Number(scriptSummary?.totalNodes ?? 0),
          state.status === 'finished',
        ),
        state.turnCount,
        state.currentObjectives.join(', '),
        scriptSummary?.title ?? null,
        scriptSummary?.description ?? null,
        scriptSummary?.theme ?? null,
        scriptSummary?.totalNodes ?? null,
        scriptSummary?.updateTime ?? null,
        gameId,
      ],
    );

    if (userId && limitConfig) {
      await this.db.execute(
        'update chat_limit_table set update_date = ?, limit_config = ? where user_id = ?',
        [normalizeTimestamp(), JSON.stringify(limitConfig), userId],
      );
    }
  }

  async saveTurnLog(params: {
    gameId: string;
    turn: number;
    playerInput: string;
    parsedIntent: unknown;
    ruleResult: unknown;
    llmOutput: unknown;
  }) {
    await this.ensureRuntimeTables();
    await this.db.replaceInto('play_turn_log_table', {
      session_id: params.gameId,
      turn_no: params.turn,
      player_input: params.playerInput,
      parsed_intent_json: JSON.stringify(params.parsedIntent),
      rule_result_json: JSON.stringify(params.ruleResult),
      llm_output_json: JSON.stringify(params.llmOutput),
      created_at: normalizeTimestamp(),
    });
  }

  markFinished(gameId: string) {
    return this.db.execute('update play_config set isFinish = ? where uuid = ?', [
      true,
      gameId,
    ]);
  }

  private buildStructuredGame(
    game: PlayConfigRow,
    state: PlayGameState,
    script: PlayScriptRecord,
    snapshot: ReturnType<typeof buildClientSnapshot>,
  ) {
    return {
      ...game,
      script_id: script.uuid,
      currentPlotId: state.currentNodeId,
      currentItems: this.stringifyInventoryLabels(state).join(','),
      isFinish: state.status === 'finished',
      mode: 'script',
      snapshot,
    };
  }

  private buildStructuredPlot(
    script: PlayScriptRecord,
    snapshot: ReturnType<typeof buildClientSnapshot>,
  ) {
    return {
      uuid: script.uuid,
      title: script.metadata.title,
      descript: script.metadata.description,
      plotTarget: snapshot.objectiveLabels.join(', '),
      worldType: script.metadata.theme,
      updateTime: script.updateTime ?? normalizeTimestamp(),
      type: script.metadata.theme,
    };
  }

  private buildCharacterResponse(character: PlayCharacterProfile) {
    return {
      uuid: character.id,
      image: character.image,
      info: JSON.stringify(character.info),
      metrics: JSON.stringify(character.metrics),
    };
  }

  private calculateProgressPercent(
    state: Partial<PlayGameState>,
    totalNodes: number,
    isFinish: boolean,
  ) {
    if (isFinish) {
      return 100;
    }

    const visitedCount = Array.isArray(state.visitedNodeIds)
      ? state.visitedNodeIds.length
      : 0;
    if (!Number.isFinite(totalNodes) || totalNodes <= 0 || visitedCount <= 0) {
      return null;
    }

    return Math.max(0, Math.min(99, Math.round((visitedCount / totalNodes) * 100)));
  }

  private normalizeTimestampValue(value: number | bigint | string | null | undefined) {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : 0;
  }

  private async loadCharacterProfile(userId: string): Promise<PlayCharacterProfile> {
    if (userId) {
      const role = await this.db.findFirst<UserRoleRow>(
        `
          select uuid, name, gender, age, strength, constitution, size, dexterity, appearance,
                 intelligence, power, education, luck, items, worlds
          from user_role_table
          where user_id = ?
          limit 1
        `,
        [userId],
      );
      if (role) {
        const info = {
          name: role.name,
          gender: role.gender ?? '',
          age: role.age ?? 18,
          items: this.parseJson<string[]>(role.items, []),
          worlds: this.parseJson<string[]>(role.worlds, []),
        };
        return {
          id: role.uuid,
          name: role.name,
          image: '',
          info,
          metrics: {
            strength: Number(role.strength ?? 50),
            constitution: Number(role.constitution ?? 50),
            size: Number(role.size ?? 50),
            dexterity: Number(role.dexterity ?? 50),
            appearance: Number(role.appearance ?? 50),
            intelligence: Number(role.intelligence ?? 50),
            power: Number(role.power ?? 50),
            education: Number(role.education ?? 50),
            luck: Number(role.luck ?? 50),
          },
        } satisfies PlayCharacterProfile;
      }
    }

    return {
      id: '',
      name: 'Traveler',
      image: '',
      info: { name: 'Traveler' },
      metrics: {} as Record<string, number>,
    } satisfies PlayCharacterProfile;
  }

  private stringifyInventoryLabels(state: PlayGameState) {
    return Object.entries(state.inventory).map(([itemId, count]) =>
      count > 1 ? `${itemId} x${count}` : itemId,
    );
  }

  private parseCommaList(raw: string | null | undefined) {
    return String(raw ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private parseJson<T>(raw: string | null | undefined, fallback: T): T {
    if (!raw) {
      return fallback;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private normalizeLoadoutLabels(items?: string[]) {
    return (items ?? []).map((item) => item.trim()).filter(Boolean);
  }

  private async resolveScriptForCreate(payload: CreatePlayPayload) {
    if (payload.script_id) {
      return (await this.scriptsService.queryByUuid(payload.script_id)) as
        | PlayScriptRecord
        | null;
    }

    const random = (await this.scriptsService.queryRandom()) as
      | { uuid: string }
      | null;
    if (!random?.uuid) {
      return null;
    }

    return (await this.scriptsService.queryByUuid(random.uuid)) as
      | PlayScriptRecord
      | null;
  }

  private async ensureRuntimeTables() {
    if (!this.tableReady) {
      this.tableReady = Promise.all([
        this.db.execute(`
          CREATE TABLE IF NOT EXISTS \`play_runtime_table\` (
            \`session_id\` varchar(32) NOT NULL,
            \`script_id\` varchar(32) NOT NULL,
            \`state_json\` longtext NOT NULL,
            \`message_log_json\` longtext NULL,
            \`created_at\` bigint NULL,
            \`updated_at\` bigint NULL,
            PRIMARY KEY (\`session_id\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `),
        this.db.execute(`
          CREATE TABLE IF NOT EXISTS \`play_turn_log_table\` (
            \`session_id\` varchar(32) NOT NULL,
            \`turn_no\` int NOT NULL,
            \`player_input\` longtext NULL,
            \`parsed_intent_json\` longtext NULL,
            \`rule_result_json\` longtext NULL,
            \`llm_output_json\` longtext NULL,
            \`created_at\` bigint NULL,
            PRIMARY KEY (\`session_id\`, \`turn_no\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `),
      ])
        .then(() => this.ensurePlayConfigSummaryColumns())
        .then(() => undefined);
    }

    return this.tableReady;
  }

  private async ensurePlayConfigSummaryColumns() {
    const existingRows = await this.db.query<{ COLUMN_NAME: string }>(
      `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'play_config'
          AND COLUMN_NAME IN (
            'latest_plot_title',
            'latest_plot_description',
            'latest_plot_theme',
            'latest_total_nodes',
            'latest_objectives',
            'progress_percent',
            'turn_count',
            'latest_plot_updateTime'
          )
      `,
    );
    const existing = new Set(existingRows.map((row) => row.COLUMN_NAME));
    const columnDefinitions = [
      ['latest_plot_title', '`latest_plot_title` text NULL'],
      ['latest_plot_description', '`latest_plot_description` longtext NULL'],
      ['latest_plot_theme', '`latest_plot_theme` text NULL'],
      ['latest_total_nodes', '`latest_total_nodes` int NULL'],
      ['latest_objectives', '`latest_objectives` longtext NULL'],
      ['progress_percent', '`progress_percent` int NULL'],
      ['turn_count', '`turn_count` int NULL'],
      ['latest_plot_updateTime', '`latest_plot_updateTime` bigint NULL'],
    ] as const;
    const missingDefinitions = columnDefinitions
      .filter(([name]) => !existing.has(name))
      .map(([, definition]) => `ADD COLUMN ${definition}`);

    if (missingDefinitions.length) {
      await this.db.execute(`
        ALTER TABLE \`play_config\`
        ${missingDefinitions.join(',\n        ')}
      `);
    }
  }
}
