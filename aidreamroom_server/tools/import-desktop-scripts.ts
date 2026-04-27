import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

import { PrismaClient } from '@prisma/client';

type ScriptMetadata = {
  title?: string;
  description?: string;
  total_events?: number;
  total_nodes?: number;
  theme?: string;
  difficulty?: string;
  required_items?: string[];
  required_knowledge?: string[];
};

type ScriptBundleFiles = {
  title: string;
  uuid: string;
  folderName: string;
  mapFile: string;
  npcFile: string;
  itemFile: string;
  scriptFile: string;
  metadata: ScriptMetadata;
};

const prisma = new PrismaClient();

function stableUuid(input: string) {
  return createHash('md5').update(input).digest('hex');
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function collectScriptFolders(rootDir: string) {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  const result: ScriptBundleFiles[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const folderPath = join(rootDir, entry.name);
    const mapPath = join(folderPath, 'map.json');
    const npcPath = join(folderPath, 'npcs.json');
    const itemPath = join(folderPath, 'items.json');
    const scriptPath = join(folderPath, 'script.json');

    if (![mapPath, npcPath, itemPath, scriptPath].every((path) => existsSync(path))) {
      continue;
    }

    const scriptJson = readJsonFile<{ metadata?: ScriptMetadata }>(scriptPath);
    const title = String(scriptJson.metadata?.title ?? entry.name).trim() || entry.name;
    result.push({
      title,
      uuid: stableUuid(`${entry.name}::${title}`),
      folderName: entry.name,
      mapFile: readFileSync(mapPath, 'utf8'),
      npcFile: readFileSync(npcPath, 'utf8'),
      itemFile: readFileSync(itemPath, 'utf8'),
      scriptFile: readFileSync(scriptPath, 'utf8'),
      metadata: scriptJson.metadata ?? {},
    });
  }

  return result.sort((left, right) => left.folderName.localeCompare(right.folderName, 'zh-Hans-CN'));
}

async function ensureScriptTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`script_table\` (
      \`uuid\` varchar(32) NOT NULL,
      \`title\` text NOT NULL,
      \`description\` longtext NULL,
      \`total_nodes\` int NULL DEFAULT 0,
      \`theme\` longtext NULL,
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
  `);

  await prisma.$executeRawUnsafe(`
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
  `);
}

async function clearAndImport(rootDir: string) {
  const bundles = collectScriptFolders(rootDir);
  if (bundles.length === 0) {
    throw new Error(`未在 ${rootDir} 下找到包含 map.json / npcs.json / items.json / script.json 的剧本目录`);
  }

  await ensureScriptTable();
  await prisma.$executeRawUnsafe('DELETE FROM script_table');

  const now = Date.now();
  for (const bundle of bundles) {
    const totalEvents = Number(bundle.metadata.total_events ?? bundle.metadata.total_nodes ?? 0);
    const requiredItems = JSON.stringify(bundle.metadata.required_items ?? []);
    const requiredKnowledge = JSON.stringify(bundle.metadata.required_knowledge ?? []);

    await prisma.$executeRawUnsafe(
      `
        REPLACE INTO script_table (
          uuid, title, description, total_nodes, theme, difficulty,
          required_items, required_knowledge,
          script_file, npc_file, item_file, map_file,
          createTime, updateTime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      bundle.uuid,
      bundle.title,
      String(bundle.metadata.description ?? ''),
      totalEvents,
      String(bundle.metadata.theme ?? ''),
      String(bundle.metadata.difficulty ?? ''),
      requiredItems,
      requiredKnowledge,
      bundle.scriptFile,
      bundle.npcFile,
      bundle.itemFile,
      bundle.mapFile,
      now,
      now,
    );
  }

  const rows = await prisma.$queryRawUnsafe<
    Array<{ uuid: string; title: string; total_nodes: number }>
  >('SELECT uuid, title, total_nodes FROM script_table ORDER BY title ASC');

  console.log(`Imported ${rows.length} scripts from ${rootDir}`);
  for (const row of rows) {
    console.log(`${row.uuid} | ${row.title} | total_events=${Number(row.total_nodes ?? 0)}`);
  }
}

async function main() {
  const explicitPath = process.argv[2];
  const rootDir = explicitPath
    ? resolve(explicitPath)
    : '/Users/zhanghaoyu/Desktop/剧本';

  if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) {
    throw new Error(`剧本目录不存在：${rootDir}`);
  }

  await clearAndImport(rootDir);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
