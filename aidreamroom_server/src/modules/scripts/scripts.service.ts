import { Injectable, OnModuleInit } from '@nestjs/common';

import { LegacyDbService } from '../../common/database/legacy-db.service';

type ScriptRow = {
  uuid: string;
  title: string;
  description: string | null;
  total_nodes: number | null;
  theme: string | null;
  difficulty: string | null;
  required_items: string | null;
  required_knowledge: string | null;
  poster: string | null;
  script_file: string | null;
  npc_file: string | null;
  item_file: string | null;
  map_file: string | null;
  createTime: number | bigint | null;
  updateTime: number | bigint | null;
};

type ScriptFileMetadata = {
  title?: string;
  description?: string;
  total_nodes?: number;
  total_events?: number;
  theme?: string;
  difficulty?: string;
  required_items?: string[];
  required_knowledge?: string[];
  story_core?: string;
  poster?: string;
  cover?: string;
  image?: string;
};

type ScriptSummaryRow = Omit<
  ScriptRow,
  'script_file' | 'npc_file' | 'item_file' | 'map_file'
> &
  Partial<Pick<ScriptRow, 'script_file' | 'npc_file' | 'item_file' | 'map_file'>>;

@Injectable()
export class ScriptsService implements OnModuleInit {
  private tableReady: Promise<void> | null = null;

  constructor(private readonly db: LegacyDbService) {}

  async onModuleInit() {
    await this.ensureTable();
  }

  async queryByUuid(uuid: string) {
    await this.ensureTable();
    const row = await this.db.findFirst<ScriptRow>(
      'select * from script_table where uuid = ? limit 1',
      [uuid],
    );
    return row ? this.buildScriptResponse(row) : null;
  }

  async queryRandom() {
    await this.ensureTable();
    const row = await this.db.findFirst<ScriptSummaryRow>(
      `
        select uuid, title, description, total_nodes, theme, difficulty, required_items, required_knowledge, poster, createTime, updateTime
        from script_table
        order by rand()
        limit 1
      `,
    );
    return row ? this.buildScriptResponse(row, false) : null;
  }

  private ensureTable() {
    if (!this.tableReady) {
      this.tableReady = (async () => {
        await this.db.execute(`
          CREATE TABLE IF NOT EXISTS \`script_table\` (
            \`uuid\` varchar(32) NOT NULL,
            \`title\` text NOT NULL,
            \`description\` longtext NULL,
            \`total_nodes\` int NULL DEFAULT 0,
            \`theme\` text NULL,
            \`difficulty\` varchar(64) NULL,
            \`required_items\` longtext NULL,
            \`required_knowledge\` longtext NULL,
            \`poster\` longtext NULL,
            \`script_file\` longtext NULL,
            \`npc_file\` longtext NULL,
            \`item_file\` longtext NULL,
            \`map_file\` longtext NULL,
            \`createTime\` bigint NULL,
            \`updateTime\` bigint NULL,
            PRIMARY KEY (\`uuid\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await this.ensurePosterColumn();
        await this.db.execute(`
            ALTER TABLE \`script_table\`
            MODIFY COLUMN \`title\` text NOT NULL,
            MODIFY COLUMN \`description\` longtext NULL,
            MODIFY COLUMN \`theme\` longtext NULL,
            MODIFY COLUMN \`difficulty\` varchar(64) NULL,
            MODIFY COLUMN \`required_items\` longtext NULL,
            MODIFY COLUMN \`required_knowledge\` longtext NULL,
            MODIFY COLUMN \`poster\` longtext NULL,
            MODIFY COLUMN \`script_file\` longtext NULL,
            MODIFY COLUMN \`npc_file\` longtext NULL,
            MODIFY COLUMN \`item_file\` longtext NULL,
            MODIFY COLUMN \`map_file\` longtext NULL
          `);
      })();
    }

    return this.tableReady;
  }

  private async ensurePosterColumn() {
    const row = await this.db.findFirst<{ total: number | string }>(
      `
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'script_table'
          AND COLUMN_NAME = 'poster'
      `,
    );

    if (Number(row?.total ?? 0) > 0) {
      return;
    }

    await this.db.execute(`
      ALTER TABLE \`script_table\`
      ADD COLUMN \`poster\` longtext NULL AFTER \`required_knowledge\`
    `);
  }

  private buildScriptResponse(row: ScriptSummaryRow, includeFiles = true) {
    const scriptMetadata = includeFiles
      ? this.parseScriptFileMetadata(row.script_file ?? null)
      : null;
    const poster = this.pickScriptPoster(row.poster, scriptMetadata);
    const totalEvents = Number(
      scriptMetadata?.total_events ?? scriptMetadata?.total_nodes ?? row.total_nodes ?? 0,
    );
    const script = {
      uuid: row.uuid,
      poster,
      metadata: {
        title: scriptMetadata?.title || row.title,
        description: scriptMetadata?.description || row.description || '',
        totalNodes: totalEvents,
        totalEvents,
        theme: scriptMetadata?.theme || row.theme || '',
        difficulty: scriptMetadata?.difficulty || row.difficulty || '',
        requiredItems:
          scriptMetadata?.required_items ?? this.parseStringList(row.required_items),
        requiredKnowledge:
          scriptMetadata?.required_knowledge ??
          this.parseStringList(row.required_knowledge),
        storyCore: scriptMetadata?.story_core ?? '',
        poster,
      },
      createTime: this.normalizeTimestamp(row.createTime),
      updateTime: this.normalizeTimestamp(row.updateTime),
    };

    if (!includeFiles) {
      return script;
    }

    return {
      ...script,
      scriptFile: row.script_file ?? '',
      npcFile: row.npc_file ?? '',
      itemFile: row.item_file ?? '',
      mapFile: row.map_file ?? '',
    };
  }

  private parseStringList(raw: string | null) {
    if (!raw) {
      return [] as string[];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // Fallback for legacy comma-separated values.
    }

    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private parseScriptFileMetadata(raw: string | null) {
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as {
        metadata?: ScriptFileMetadata;
      };
      return parsed.metadata ?? null;
    } catch {
      return null;
    }
  }

  private pickScriptPoster(
    rowPoster: string | null | undefined,
    scriptMetadata: ScriptFileMetadata | null,
  ) {
    return (
      this.normalizeOptionalText(rowPoster) ||
      this.normalizeOptionalText(scriptMetadata?.poster) ||
      this.normalizeOptionalText(scriptMetadata?.cover) ||
      this.normalizeOptionalText(scriptMetadata?.image)
    );
  }

  private normalizeOptionalText(value: unknown) {
    return String(value ?? '').trim();
  }

  private normalizeTimestamp(value: number | bigint | null) {
    return value === null ? 0 : Number(value);
  }
}
