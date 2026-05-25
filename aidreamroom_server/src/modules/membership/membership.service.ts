import { Injectable } from '@nestjs/common';

import { LegacyDbService } from '../../common/database/legacy-db.service';
import {
  DEFAULT_MEMBERSHIP_LEVEL,
  MEMBERSHIP_LEVELS,
  MembershipLevel,
  MODULE_LIST,
} from '../../common/utils/legacy.constants';
import { normalizeTimestamp } from '../../common/utils/number.util';

export type LimitTimes = number | '无限';

export type LimitConfigItem = {
  times: LimitTimes;
  moduleId: number;
  membershipLevel?: MembershipLevel;
  dailyLimit?: LimitTimes;
};

export type MembershipSummary = {
  membership_level: MembershipLevel;
  membership_label: string;
  daily_ai_limit: LimitTimes;
  daily_ai_limit_text: string;
  remain_ai_times: LimitTimes;
  remain_ai_times_text: string;
};

@Injectable()
export class MembershipService {
  constructor(private readonly db: LegacyDbService) {}

  async ensureSchema() {
    await this.ensureChatLimitTable();
    await this.ensureChatUsageLogTable();
    await this.ensureMembershipColumn();
  }

  async queryRemainTimes(userId: string) {
    await this.ensureSchema();

    const membershipLevel = await this.queryMembershipLevel(userId);
    const current = await this.db.findFirst<{ update_date: number; limit_config: string }>(
      'select * from chat_limit_table where user_id = ?',
      [userId],
    );
    let config = this.buildMembershipLimitConfig(membershipLevel);

    if (current) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      const currentDayStart = date.getTime();
      if (currentDayStart > Number(current.update_date ?? 0)) {
        await this.saveRemainTimes(userId, config);
      } else {
        config = this.normalizeLimitConfig(
          JSON.parse(current.limit_config ?? '[]') as LimitConfigItem[],
          membershipLevel,
        );
      }
    } else {
      await this.saveRemainTimes(userId, config);
    }

    return config;
  }

  async hasRemainTimes(userId: string) {
    const config = await this.queryRemainTimes(userId);
    return config.some((item) => item.times === '无限' || Number(item.times) > 0);
  }

  async queryMembershipSummary(userId: string): Promise<MembershipSummary> {
    await this.ensureSchema();

    const level = await this.queryMembershipLevel(userId);
    const membership = MEMBERSHIP_LEVELS[level] ?? MEMBERSHIP_LEVELS[DEFAULT_MEMBERSHIP_LEVEL];
    const remainConfig = await this.queryRemainTimes(userId);
    const remainTimes = remainConfig[0]?.times ?? membership.dailyLimit;

    return {
      membership_level: level,
      membership_label: membership.label,
      daily_ai_limit: membership.dailyLimit,
      daily_ai_limit_text: this.formatLimitTimes(membership.dailyLimit),
      remain_ai_times: remainTimes,
      remain_ai_times_text: this.formatLimitTimes(remainTimes),
    };
  }

  async consumeRemainTime(userId: string) {
    const config = await this.queryRemainTimes(userId);
    const unlimited = config.some((item) => item.times === '无限');
    if (unlimited) {
      return config;
    }

    const currentRemain = Math.max(
      0,
      ...config.map((item) => Number(item.times)).filter((value) => Number.isFinite(value)),
    );
    if (currentRemain <= 0) {
      return config;
    }

    const nextRemain = currentRemain - 1;
    const nextConfig = config.map((item) => ({
      ...item,
      times: nextRemain,
    }));
    await this.saveRemainTimes(userId, nextConfig);
    await this.recordChatUsage(userId, nextRemain);
    return nextConfig;
  }

  async saveRemainTimes(userId: string, config: LimitConfigItem[]) {
    await this.ensureSchema();
    await this.db.replaceInto('chat_limit_table', {
      user_id: userId,
      update_date: normalizeTimestamp(),
      limit_config: JSON.stringify(config),
    });
  }

  private async ensureChatLimitTable() {
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS \`chat_limit_table\` (
        \`user_id\` varchar(191) NOT NULL,
        \`update_date\` bigint NULL,
        \`limit_config\` longtext NULL,
        PRIMARY KEY (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  private async ensureChatUsageLogTable() {
    await this.db.execute(`
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

  private buildMembershipLimitConfig(level: MembershipLevel): LimitConfigItem[] {
    const membership = MEMBERSHIP_LEVELS[level] ?? MEMBERSHIP_LEVELS[DEFAULT_MEMBERSHIP_LEVEL];
    return MODULE_LIST.map((item) => ({
      moduleId: item.moduleId,
      times: membership.dailyLimit,
      membershipLevel: level,
      dailyLimit: membership.dailyLimit,
    }));
  }

  private normalizeLimitConfig(config: LimitConfigItem[], level: MembershipLevel) {
    const membership = MEMBERSHIP_LEVELS[level] ?? MEMBERSHIP_LEVELS[DEFAULT_MEMBERSHIP_LEVEL];
    if (!Array.isArray(config) || !config.length) {
      return this.buildMembershipLimitConfig(level);
    }

    const first = config[0];
    if (!first?.membershipLevel || first.membershipLevel !== level) {
      return this.buildMembershipLimitConfig(level);
    }

    if (membership.dailyLimit === '无限') {
      return this.buildMembershipLimitConfig(level);
    }

    const remain = Math.max(
      0,
      ...config
        .map((item) => Number(item.times))
        .filter((value) => Number.isFinite(value)),
    );
    return MODULE_LIST.map((item) => ({
      moduleId: item.moduleId,
      times: Math.min(remain, membership.dailyLimit),
      membershipLevel: level,
      dailyLimit: membership.dailyLimit,
    }));
  }

  private formatLimitTimes(times: LimitTimes) {
    return times === '无限' ? '不限次数' : `${times} 次/天`;
  }

  private formatChinaDate(timestamp: number) {
    return new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  private async recordChatUsage(userId: string, remainingAfter: number) {
    await this.ensureChatUsageLogTable();
    const now = Date.now();
    const usageDate = this.formatChinaDate(now);
    await this.db.execute(
      `
        INSERT INTO \`chat_usage_log_table\`
          (\`user_id\`, \`usage_date\`, \`created_at\`, \`remaining_after\`, \`exhausted_after\`, \`source\`)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [userId, usageDate, now, remainingAfter, remainingAfter <= 0, 'chat'],
    );
  }

  private async queryMembershipLevel(userId: string): Promise<MembershipLevel> {
    const row = await this.db.findFirst<{ membership_level: string | null }>(
      'select membership_level from user_table where uuid = ? limit 1',
      [userId],
    );
    const level = String(row?.membership_level || DEFAULT_MEMBERSHIP_LEVEL) as MembershipLevel;
    return Object.prototype.hasOwnProperty.call(MEMBERSHIP_LEVELS, level)
      ? level
      : DEFAULT_MEMBERSHIP_LEVEL;
  }

  private async ensureMembershipColumn() {
    const row = await this.db.findFirst<{ total: number | string; column_default: string | null }>(
      `
        SELECT COUNT(*) AS total, MAX(COLUMN_DEFAULT) AS column_default
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'user_table'
          AND COLUMN_NAME = 'membership_level'
      `,
    );

    if (Number(row?.total ?? 0) > 0) {
      await this.db.execute(
        'update user_table set membership_level = ? where membership_level is null or membership_level = ?',
        [DEFAULT_MEMBERSHIP_LEVEL, ''],
      );
      if (row?.column_default !== DEFAULT_MEMBERSHIP_LEVEL) {
        await this.db.execute(
          `ALTER TABLE \`user_table\` MODIFY COLUMN \`membership_level\` varchar(32) NOT NULL DEFAULT '${DEFAULT_MEMBERSHIP_LEVEL}'`,
        );
      }
      return;
    }

    await this.db.execute(`
      ALTER TABLE \`user_table\`
      ADD COLUMN \`membership_level\` varchar(32) NOT NULL DEFAULT '${DEFAULT_MEMBERSHIP_LEVEL}' AFTER \`vip\`
    `);
  }
}
