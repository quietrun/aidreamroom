import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import { PrismaClient } from '@prisma/client';

type Row = Record<string, unknown>;

type Options = {
  from: string;
  to: string;
  json: boolean;
  timezoneOffsetHours: number;
};

type DailyMetric = {
  date: string;
  new_users: number;
  dau: number;
  retained_users: number;
  retention_rate: string;
  new_user_d1_retained: number;
  script_play_count: number;
  script_play_users: number;
  dialogue_count: number;
  exhausted_users: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

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

function formatDate(timestamp: number, timezoneOffsetHours: number) {
  return new Date(timestamp + timezoneOffsetHours * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function parseDateStart(date: string, timezoneOffsetHours: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new Error(`日期格式错误: ${date}，请使用 YYYY-MM-DD`);
  }

  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day)) - timezoneOffsetHours * 60 * 60 * 1000;
}

function addDays(date: string, days: number, timezoneOffsetHours: number) {
  return formatDate(parseDateStart(date, timezoneOffsetHours) + days * DAY_MS, timezoneOffsetHours);
}

function listDates(from: string, to: string, timezoneOffsetHours: number) {
  const dates: string[] = [];
  const start = parseDateStart(from, timezoneOffsetHours);
  const end = parseDateStart(to, timezoneOffsetHours);
  for (let time = start; time <= end; time += DAY_MS) {
    dates.push(formatDate(time, timezoneOffsetHours));
  }
  return dates;
}

function parseArgs(): Options {
  const today = formatDate(Date.now(), 8);
  const defaultFrom = addDays(today, -6, 8);
  const options: Options = {
    from: defaultFrom,
    to: today,
    json: false,
    timezoneOffsetHours: 8,
  };

  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    const next = process.argv[index + 1];

    if (arg === '--from' && next) {
      options.from = next;
      index += 1;
    } else if (arg === '--to' && next) {
      options.to = next;
      index += 1;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--tz' && next) {
      const match = /^([+-])(\d{2})(?::?(\d{2}))?$/.exec(next);
      if (!match) {
        throw new Error('--tz 请使用 +08:00 这样的格式');
      }
      const sign = match[1] === '-' ? -1 : 1;
      const hours = Number(match[2]);
      const minutes = Number(match[3] ?? 0);
      options.timezoneOffsetHours = sign * (hours + minutes / 60);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (parseDateStart(options.from, options.timezoneOffsetHours) > parseDateStart(options.to, options.timezoneOffsetHours)) {
    throw new Error('--from 不能晚于 --to');
  }

  return options;
}

function printHelp() {
  console.log(`
用法:
  npm run analytics:daily -- --from 2026-05-01 --to 2026-05-25
  npm run analytics:daily -- --from 2026-05-01 --to 2026-05-25 --json

字段:
  new_users              当天新注册用户数
  dau                    当天有对话/游玩行为的用户数
  retained_users         昨天活跃且今天仍活跃的用户数
  retention_rate         retained_users / 昨天 DAU
  new_user_d1_retained   昨天注册且今天活跃的用户数
  script_play_count      当天新开剧本游玩会话数
  script_play_users      当天新开剧本游玩的用户数
  dialogue_count         当天对话扣次数量；旧数据无扣次日志时回退为游玩 turn 数
  exhausted_users        当天扣到 0 次的用户数；仅新增扣次日志后可回溯
`);
}

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function stringValue(value: unknown) {
  return String(value ?? '').trim();
}

function ensureSet(map: Map<string, Set<string>>, key: string) {
  let set = map.get(key);
  if (!set) {
    set = new Set<string>();
    map.set(key, set);
  }
  return set;
}

function increment(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

async function ensureChatUsageLogTable(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`chat_usage_log_table\` (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`user_id\` varchar(191) NOT NULL,
      \`usage_date\` char(10) NOT NULL,
      \`created_at\` bigint NOT NULL,
      \`remaining_after\` int NULL,
      \`exhausted_after\` tinyint(1) NOT NULL DEFAULT 0,
      \`source\` varchar(32) NOT NULL DEFAULT 'chat',
      PRIMARY KEY (\`id\`),
      KEY \`idx_chat_usage_date_user\` (\`usage_date\`, \`user_id\`),
      KEY \`idx_chat_usage_created_at\` (\`created_at\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function printTable(metrics: DailyMetric[]) {
  const headers = [
    'date',
    'new_users',
    'dau',
    'retained_users',
    'retention_rate',
    'new_user_d1_retained',
    'script_play_count',
    'script_play_users',
    'dialogue_count',
    'exhausted_users',
  ];

  const widths = headers.map((header) =>
    Math.max(header.length, ...metrics.map((row) => String(row[header as keyof DailyMetric]).length)),
  );

  const formatRow = (values: string[]) => values.map((value, index) => value.padEnd(widths[index])).join('  ');
  console.log(formatRow(headers));
  console.log(formatRow(headers.map((header) => '-'.repeat(header.length))));
  for (const row of metrics) {
    console.log(formatRow(headers.map((header) => String(row[header as keyof DailyMetric]))));
  }
}

async function main() {
  loadDotEnv();
  const options = parseArgs();
  const prisma = new PrismaClient();

  const dates = listDates(options.from, options.to, options.timezoneOffsetHours);
  const fromStart = parseDateStart(options.from, options.timezoneOffsetHours);
  const queryStart = fromStart - DAY_MS;
  const queryEnd = parseDateStart(addDays(options.to, 1, options.timezoneOffsetHours), options.timezoneOffsetHours);

  try {
    await ensureChatUsageLogTable(prisma);

    const [users, usageLogs, turnLogs, sessions] = await Promise.all([
      prisma.$queryRawUnsafe<Row[]>(
        'select uuid, createTime from user_table where createTime >= ? and createTime < ?',
        queryStart,
        queryEnd,
      ),
      prisma.$queryRawUnsafe<Row[]>(
        'select user_id, created_at, exhausted_after from chat_usage_log_table where created_at >= ? and created_at < ?',
        queryStart,
        queryEnd,
      ),
      prisma.$queryRawUnsafe<Row[]>(
        `
          select pc.creator as user_id, ptl.session_id, ptl.created_at
          from play_turn_log_table ptl
          join play_config pc on pc.uuid = ptl.session_id
          where ptl.created_at >= ? and ptl.created_at < ?
        `,
        queryStart,
        queryEnd,
      ),
      prisma.$queryRawUnsafe<Row[]>(
        `
          select pc.creator as user_id, prt.session_id, prt.created_at
          from play_runtime_table prt
          join play_config pc on pc.uuid = prt.session_id
          where prt.created_at >= ? and prt.created_at < ?
        `,
        queryStart,
        queryEnd,
      ),
    ]);

    const newUsersByDate = new Map<string, Set<string>>();
    const activeUsersByDate = new Map<string, Set<string>>();
    const exhaustedUsersByDate = new Map<string, Set<string>>();
    const scriptPlayUsersByDate = new Map<string, Set<string>>();
    const scriptPlaysByDate = new Map<string, number>();
    const usageDialogueCountByDate = new Map<string, number>();
    const turnDialogueCountByDate = new Map<string, number>();

    for (const row of users) {
      const userId = stringValue(row.uuid);
      const createdAt = numberValue(row.createTime);
      if (userId && createdAt) {
        ensureSet(newUsersByDate, formatDate(createdAt, options.timezoneOffsetHours)).add(userId);
      }
    }

    for (const row of usageLogs) {
      const userId = stringValue(row.user_id);
      const createdAt = numberValue(row.created_at);
      if (!userId || !createdAt) {
        continue;
      }
      const date = formatDate(createdAt, options.timezoneOffsetHours);
      ensureSet(activeUsersByDate, date).add(userId);
      increment(usageDialogueCountByDate, date);
      if (numberValue(row.exhausted_after) === 1) {
        ensureSet(exhaustedUsersByDate, date).add(userId);
      }
    }

    for (const row of turnLogs) {
      const userId = stringValue(row.user_id);
      const createdAt = numberValue(row.created_at);
      if (!userId || !createdAt) {
        continue;
      }
      const date = formatDate(createdAt, options.timezoneOffsetHours);
      ensureSet(activeUsersByDate, date).add(userId);
      increment(turnDialogueCountByDate, date);
    }

    for (const row of sessions) {
      const userId = stringValue(row.user_id);
      const sessionId = stringValue(row.session_id);
      const createdAt = numberValue(row.created_at);
      if (!sessionId || !createdAt) {
        continue;
      }
      const date = formatDate(createdAt, options.timezoneOffsetHours);
      increment(scriptPlaysByDate, date);
      if (userId) {
        ensureSet(scriptPlayUsersByDate, date).add(userId);
      }
    }

    const metrics = dates.map<DailyMetric>((date) => {
      const previousDate = addDays(date, -1, options.timezoneOffsetHours);
      const activeUsers = activeUsersByDate.get(date) ?? new Set<string>();
      const previousActiveUsers = activeUsersByDate.get(previousDate) ?? new Set<string>();
      const retainedUsers = [...activeUsers].filter((userId) => previousActiveUsers.has(userId)).length;
      const previousNewUsers = newUsersByDate.get(previousDate) ?? new Set<string>();
      const newUserD1Retained = [...activeUsers].filter((userId) => previousNewUsers.has(userId)).length;
      const usageDialogueCount = usageDialogueCountByDate.get(date) ?? 0;
      const fallbackTurnDialogueCount = turnDialogueCountByDate.get(date) ?? 0;

      return {
        date,
        new_users: newUsersByDate.get(date)?.size ?? 0,
        dau: activeUsers.size,
        retained_users: retainedUsers,
        retention_rate: previousActiveUsers.size
          ? `${((retainedUsers / previousActiveUsers.size) * 100).toFixed(2)}%`
          : '--',
        new_user_d1_retained: newUserD1Retained,
        script_play_count: scriptPlaysByDate.get(date) ?? 0,
        script_play_users: scriptPlayUsersByDate.get(date)?.size ?? 0,
        dialogue_count: usageDialogueCount > 0 ? usageDialogueCount : fallbackTurnDialogueCount,
        exhausted_users: exhaustedUsersByDate.get(date)?.size ?? 0,
      };
    });

    if (options.json) {
      console.log(JSON.stringify(metrics, null, 2));
    } else {
      printTable(metrics);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
