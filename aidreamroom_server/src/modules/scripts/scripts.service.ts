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
  script_file: string | null;
  npc_file: string | null;
  item_file: string | null;
  map_file: string | null;
  createTime: number | bigint | null;
  updateTime: number | bigint | null;
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
        select uuid, title, description, total_nodes, theme, difficulty, required_items, required_knowledge, createTime, updateTime
        from script_table
        order by rand()
        limit 1
      `,
    );
    return row ? this.buildScriptResponse(row, false) : null;
  }

  private ensureTable() {
    if (!this.tableReady) {
      this.tableReady = this.db
        .execute(`
          CREATE TABLE IF NOT EXISTS \`script_table\` (
            \`uuid\` varchar(32) NOT NULL,
            \`title\` text NOT NULL,
            \`description\` longtext NULL,
            \`total_nodes\` int NULL DEFAULT 0,
            \`theme\` text NULL,
            \`difficulty\` varchar(64) NULL,
            \`required_items\` longtext NULL,
            \`required_knowledge\` longtext NULL,
            \`script_file\` longtext NULL,
            \`npc_file\` longtext NULL,
            \`item_file\` longtext NULL,
            \`map_file\` longtext NULL,
            \`createTime\` bigint NULL,
            \`updateTime\` bigint NULL,
            PRIMARY KEY (\`uuid\`)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)
        .then(() =>
          this.db.execute(`
            ALTER TABLE \`script_table\`
            MODIFY COLUMN \`title\` text NOT NULL,
            MODIFY COLUMN \`description\` longtext NULL,
            MODIFY COLUMN \`theme\` longtext NULL,
            MODIFY COLUMN \`difficulty\` varchar(64) NULL,
            MODIFY COLUMN \`required_items\` longtext NULL,
            MODIFY COLUMN \`required_knowledge\` longtext NULL,
            MODIFY COLUMN \`script_file\` longtext NULL,
            MODIFY COLUMN \`npc_file\` longtext NULL,
            MODIFY COLUMN \`item_file\` longtext NULL,
            MODIFY COLUMN \`map_file\` longtext NULL
          `),
        )
        .then(() => undefined);
    }

    return this.tableReady;
  }

  private buildScriptResponse(row: ScriptSummaryRow, includeFiles = true) {
    const scriptMetadata = includeFiles
      ? this.parseScriptFileMetadata(row.script_file ?? null)
      : null;
    const script = {
      uuid: row.uuid,
      metadata: {
        title: scriptMetadata?.title || row.title,
        description: scriptMetadata?.description || row.description || '',
        totalNodes: Number(scriptMetadata?.total_events ?? row.total_nodes ?? 0),
        totalEvents: Number(scriptMetadata?.total_events ?? row.total_nodes ?? 0),
        theme: scriptMetadata?.theme || row.theme || '',
        difficulty: scriptMetadata?.difficulty || row.difficulty || '',
        requiredItems:
          scriptMetadata?.required_items ?? this.parseStringList(row.required_items),
        requiredKnowledge:
          scriptMetadata?.required_knowledge ??
          this.parseStringList(row.required_knowledge),
        storyCore: scriptMetadata?.story_core ?? '',
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
        metadata?: {
          title?: string;
          description?: string;
          total_events?: number;
          theme?: string;
          difficulty?: string;
          required_items?: string[];
          required_knowledge?: string[];
          story_core?: string;
        };
      };
      return parsed.metadata ?? null;
    } catch {
      return null;
    }
  }

  private normalizeTimestamp(value: number | bigint | null) {
    return value === null ? 0 : Number(value);
  }
}
