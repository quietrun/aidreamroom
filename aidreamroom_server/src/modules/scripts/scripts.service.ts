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
            \`theme\` varchar(64) NULL,
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
        .then(() => undefined);
    }

    return this.tableReady;
  }

  private buildScriptResponse(row: ScriptSummaryRow, includeFiles = true) {
    const script = {
      uuid: row.uuid,
      metadata: {
        title: row.title,
        description: row.description ?? '',
        totalNodes: Number(row.total_nodes ?? 0),
        theme: row.theme ?? '',
        difficulty: row.difficulty ?? '',
        requiredItems: this.parseStringList(row.required_items),
        requiredKnowledge: this.parseStringList(row.required_knowledge),
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

  private normalizeTimestamp(value: number | bigint | null) {
    return value === null ? 0 : Number(value);
  }
}
