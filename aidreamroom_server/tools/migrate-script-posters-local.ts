import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { copyFile, mkdir } from 'fs/promises';
import { extname, join, resolve } from 'path';

import { PrismaClient } from '@prisma/client';

type ScriptMetadata = {
  title?: string;
};

type LocalScriptPoster = {
  title: string;
  folderName: string;
  uuid: string;
  posterPath: string;
};

type ExistingScriptRow = {
  uuid: string;
  title: string;
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

function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const index = trimmed.indexOf('=');
    if (index < 0) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^"(.*)"$/, '$1');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function buildDatasourceUrl() {
  const rawUrl = process.env.DATABASE_URL ?? '';
  if (!rawUrl) {
    return rawUrl;
  }

  const url = new URL(rawUrl);
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', process.env.PRISMA_CONNECTION_LIMIT ?? '5');
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', process.env.PRISMA_POOL_TIMEOUT ?? '15');
  }

  return url.toString();
}

function normalizeScriptName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[`~!@#$%^&*()_\-+=[\]{};:'",.<>/?\\|，。！？、：；（）【】《》「」『』·]/g, '');
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

function collectLocalPosters(rootDir: string) {
  const posters: LocalScriptPoster[] = [];

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const folderPath = join(rootDir, entry.name);
    const scriptPath = join(folderPath, 'script.json');
    const posterPath = findPosterPath(folderPath);
    if (!existsSync(scriptPath) || !posterPath) {
      continue;
    }

    const script = JSON.parse(readFileSync(scriptPath, 'utf8')) as {
      metadata?: ScriptMetadata;
    };
    const title = String(script.metadata?.title ?? entry.name).trim() || entry.name;

    posters.push({
      title,
      folderName: entry.name,
      uuid: stableUuid(`${entry.name}::${title}`),
      posterPath,
    });
  }

  return posters.sort((left, right) => left.folderName.localeCompare(right.folderName, 'zh-Hans-CN'));
}

function scoreMatch(poster: LocalScriptPoster, row: ExistingScriptRow) {
  const localNames = [poster.title, poster.folderName].map(normalizeScriptName);
  const dbNames = [row.title].map(normalizeScriptName);

  if (row.uuid === poster.uuid) {
    return 500;
  }
  if (dbNames.includes(normalizeScriptName(poster.title))) {
    return 400;
  }
  if (dbNames.includes(normalizeScriptName(poster.folderName))) {
    return 300;
  }
  if (dbNames.some((name) => localNames.includes(name))) {
    return 200;
  }

  return 0;
}

function findMatchingRow(
  poster: LocalScriptPoster,
  rows: ExistingScriptRow[],
  claimedUuids: Set<string>,
) {
  let bestRow: ExistingScriptRow | null = null;
  let bestScore = 0;

  for (const row of rows) {
    if (claimedUuids.has(row.uuid)) {
      continue;
    }

    const score = scoreMatch(poster, row);
    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    }
  }

  return bestScore > 0 ? bestRow : null;
}

function buildPublicUrl(relativePath: string) {
  const baseUrl = process.env.LOCAL_PUBLIC_BASE_URL?.replace(/\/$/, '');
  const normalizedPath = relativePath.split('\\').join('/');

  if (baseUrl) {
    return `${baseUrl}/uploads/${normalizedPath}`;
  }

  return `http://localhost:${process.env.PORT || 8380}/uploads/${normalizedPath}`;
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
  loadDotEnv();

  const explicitPath = process.argv[2];
  const rootDir = explicitPath ? resolve(explicitPath) : resolveDefaultRootDir();
  if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) {
    throw new Error(`剧本目录不存在：${rootDir}`);
  }

  const posters = collectLocalPosters(rootDir);
  if (posters.length === 0) {
    throw new Error(`未在 ${rootDir} 下找到 poster 图片`);
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: buildDatasourceUrl(),
      },
    },
  });
  const uploadRoot = resolve(process.cwd(), process.env.LOCAL_UPLOAD_DIR ?? 'uploads');
  const posterDir = resolve(uploadRoot, 'script-posters');

  await mkdir(posterDir, { recursive: true });

  const rows = await prisma.$queryRawUnsafe<ExistingScriptRow[]>(
    'select uuid, title from script_table',
  );
  const claimedUuids = new Set<string>();
  let updated = 0;
  let skipped = 0;

  for (const poster of posters) {
    const row = findMatchingRow(poster, rows, claimedUuids);
    if (!row) {
      skipped += 1;
      console.log(`skipped ${poster.folderName}: no matching database row`);
      continue;
    }

    claimedUuids.add(row.uuid);

    const extension = extname(poster.posterPath).toLowerCase() || '.png';
    const fileName = `${row.uuid}${extension}`;
    const relativePath = `script-posters/${fileName}`;
    const publicUrl = buildPublicUrl(relativePath);

    await copyFile(poster.posterPath, resolve(posterDir, fileName));
    await prisma.$executeRawUnsafe(
      'update script_table set poster = ? where uuid = ?',
      publicUrl,
      row.uuid,
    );

    updated += 1;
    console.log(`updated ${row.uuid} | ${poster.title} -> ${publicUrl}`);
  }

  await prisma.$disconnect();
  console.log(`done. updated=${updated} skipped=${skipped}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
