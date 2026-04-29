import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { extname, join, resolve } from 'path';

import { PrismaClient } from '@prisma/client';

type ScriptMetadata = {
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

type ScriptBundleFiles = {
  title: string;
  uuid: string;
  folderName: string;
  posterPath: string | null;
  mapFile: string;
  npcFile: string;
  itemFile: string;
  scriptFile: string;
  metadata: ScriptMetadata;
};

type ExistingScriptRow = {
  uuid: string;
  title: string;
  poster: string | null;
  script_file: string | null;
  createTime: number | bigint | string | null;
};

const prisma = new PrismaClient();
const POSTER_MIME_TYPE_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};
const POSTER_FILE_NAMES = [
  'poster.png',
  'poster.jpg',
  'poster.jpeg',
  'poster.webp',
  'poster.avif',
  'poster.gif',
];

function stableUuid(input: string) {
  return createHash('md5').update(input).digest('hex');
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function normalizeScriptName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[`~!@#$%^&*()_\-+=[\]{};:'",.<>/?\\|，。！？、：；（）【】《》「」『』·]/g, '');
}

function uniqueNames(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? '').trim())
        .filter(Boolean),
    ),
  );
}

function parseScriptMetadata(raw: string | null) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { metadata?: ScriptMetadata };
    return parsed.metadata ?? null;
  } catch {
    return null;
  }
}

function findPosterPath(folderPath: string) {
  for (const fileName of POSTER_FILE_NAMES) {
    const candidatePath = join(folderPath, fileName);
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  const fallback = readdirSync(folderPath, { withFileTypes: true }).find(
    (entry) => entry.isFile() && /^poster(\.|$)/i.test(entry.name),
  );

  return fallback ? join(folderPath, fallback.name) : null;
}

function buildPosterDataUrl(path: string) {
  const mimeType = POSTER_MIME_TYPE_MAP[extname(path).toLowerCase()] ?? 'application/octet-stream';
  const base64 = readFileSync(path).toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

function normalizeTimestamp(value: number | bigint | string | null | undefined, fallback: number) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function scoreExistingScriptRow(bundle: ScriptBundleFiles, row: ExistingScriptRow) {
  const bundleNames = uniqueNames([bundle.title, bundle.folderName]);
  const normalizedBundleNames = new Set(bundleNames.map((name) => normalizeScriptName(name)));
  const rowNames = uniqueNames([row.title, parseScriptMetadata(row.script_file)?.title]);
  let bestScore = 0;

  for (const rowName of rowNames) {
    if (rowName === bundle.title) {
      bestScore = Math.max(bestScore, 400);
    }
    if (rowName === bundle.folderName) {
      bestScore = Math.max(bestScore, 320);
    }
    if (normalizedBundleNames.has(normalizeScriptName(rowName))) {
      bestScore = Math.max(bestScore, 200);
    }
  }

  return bestScore;
}

function findExistingScriptRow(
  bundle: ScriptBundleFiles,
  existingRows: ExistingScriptRow[],
  claimedUuids: Set<string>,
) {
  const directUuidMatch = existingRows.find(
    (row) => row.uuid === bundle.uuid && !claimedUuids.has(row.uuid),
  );
  if (directUuidMatch) {
    return directUuidMatch;
  }

  let bestRow: ExistingScriptRow | null = null;
  let bestScore = 0;

  for (const row of existingRows) {
    if (claimedUuids.has(row.uuid)) {
      continue;
    }

    const score = scoreExistingScriptRow(bundle, row);
    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    }
  }

  return bestScore > 0 ? bestRow : null;
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
      posterPath: findPosterPath(folderPath),
      mapFile: readFileSync(mapPath, 'utf8'),
      npcFile: readFileSync(npcPath, 'utf8'),
      itemFile: readFileSync(itemPath, 'utf8'),
      scriptFile: readFileSync(scriptPath, 'utf8'),
      metadata: scriptJson.metadata ?? {},
    });
  }

  return result.sort((left, right) => left.folderName.localeCompare(right.folderName, 'zh-Hans-CN'));
}

async function ensurePosterColumn() {
  const rows = await prisma.$queryRawUnsafe<Array<{ total: number | bigint | string }>>(
    `
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'script_table'
        AND COLUMN_NAME = 'poster'
    `,
  );

  if (Number(rows[0]?.total ?? 0) > 0) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    ALTER TABLE \`script_table\`
    ADD COLUMN \`poster\` longtext NULL AFTER \`required_knowledge\`
  `);
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

  await ensurePosterColumn();

  await prisma.$executeRawUnsafe(`
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
}

async function syncScripts(rootDir: string) {
  const bundles = collectScriptFolders(rootDir);
  if (bundles.length === 0) {
    throw new Error(`未在 ${rootDir} 下找到包含 map.json / npcs.json / items.json / script.json 的剧本目录`);
  }

  await ensureScriptTable();
  const existingRows = await prisma.$queryRawUnsafe<ExistingScriptRow[]>(
    `
      SELECT uuid, title, poster, script_file, createTime
      FROM script_table
      ORDER BY updateTime DESC, createTime DESC
    `,
  );

  const claimedUuids = new Set<string>();
  let insertedCount = 0;
  let updatedCount = 0;
  let posterUpdatedCount = 0;
  const now = Date.now();

  for (const bundle of bundles) {
    const existingRow = findExistingScriptRow(bundle, existingRows, claimedUuids);
    if (existingRow) {
      claimedUuids.add(existingRow.uuid);
    }

    const poster = bundle.posterPath
      ? buildPosterDataUrl(bundle.posterPath)
      : String(existingRow?.poster ?? '').trim();
    const totalEvents = Number(bundle.metadata.total_events ?? bundle.metadata.total_nodes ?? 0);
    const requiredItems = JSON.stringify(bundle.metadata.required_items ?? []);
    const requiredKnowledge = JSON.stringify(bundle.metadata.required_knowledge ?? []);
    const uuid = existingRow?.uuid ?? bundle.uuid;
    const createTime = normalizeTimestamp(existingRow?.createTime, now);

    if (poster && poster !== String(existingRow?.poster ?? '').trim()) {
      posterUpdatedCount += 1;
    }

    await prisma.$executeRawUnsafe(
      `
        REPLACE INTO script_table (
          uuid, title, description, total_nodes, theme, difficulty,
          required_items, required_knowledge, poster,
          script_file, npc_file, item_file, map_file,
          createTime, updateTime
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      uuid,
      bundle.title,
      String(bundle.metadata.description ?? ''),
      totalEvents,
      String(bundle.metadata.theme ?? ''),
      String(bundle.metadata.difficulty ?? ''),
      requiredItems,
      requiredKnowledge,
      poster,
      bundle.scriptFile,
      bundle.npcFile,
      bundle.itemFile,
      bundle.mapFile,
      createTime,
      now,
    );

    if (existingRow) {
      updatedCount += 1;
    } else {
      insertedCount += 1;
    }
  }

  const rows = await prisma.$queryRawUnsafe<
    Array<{ uuid: string; title: string; total_nodes: number; poster: string | null }>
  >('SELECT uuid, title, total_nodes, poster FROM script_table ORDER BY title ASC');

  console.log(`Synced ${bundles.length} scripts from ${rootDir}`);
  console.log(`Inserted ${insertedCount}, updated ${updatedCount}, poster refreshed ${posterUpdatedCount}`);
  for (const row of rows) {
    console.log(
      `${row.uuid} | ${row.title} | total_events=${Number(row.total_nodes ?? 0)} | poster=${row.poster ? 'yes' : 'no'}`,
    );
  }
}

function resolveDefaultRootDir() {
  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '';
  const candidateDirs = [
    join(homeDir, 'Desktop', 'workshop', '剧本'),
    join(homeDir, 'Desktop', '剧本'),
  ];

  return candidateDirs.find((path) => existsSync(path) && statSync(path).isDirectory()) ?? candidateDirs[0];
}

async function main() {
  const explicitPath = process.argv[2];
  const rootDir = explicitPath ? resolve(explicitPath) : resolveDefaultRootDir();

  if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) {
    throw new Error(`剧本目录不存在：${rootDir}`);
  }

  await syncScripts(rootDir);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
