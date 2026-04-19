import { Injectable } from '@nestjs/common';

import { PrismaService } from './prisma.service';

type QueryParam = string | number | bigint | boolean | null;

@Injectable()
export class LegacyDbService {
  constructor(private readonly prisma: PrismaService) {}

  async query<T = Record<string, unknown>>(
    statement: string,
    params: QueryParam[] = [],
  ): Promise<T[]> {
    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(statement, ...params);
    return this.normalizeQueryResult(rows) as T[];
  }

  async execute(
    statement: string,
    params: QueryParam[] = [],
  ): Promise<number> {
    return this.prisma.$executeRawUnsafe(statement, ...params);
  }

  async replaceInto(tableName: string, data: Record<string, unknown>) {
    const keys = Object.keys(data).filter((key) => data[key] !== undefined);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map((key) => this.normalizeValue(data[key]));
    const statement = `REPLACE INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
    await this.prisma.$executeRawUnsafe(statement, ...values);
  }

  async findFirst<T = Record<string, unknown>>(
    statement: string,
    params: QueryParam[] = [],
  ): Promise<T | null> {
    const rows = await this.query<T>(statement, params);
    return rows[0] ?? null;
  }

  buildInClause(items: readonly string[]) {
    return {
      sql: items.map(() => '?').join(', '),
      params: [...items],
    };
  }

  private normalizeValue(value: unknown): QueryParam {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === 'bigint' || typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    return String(value);
  }

  private normalizeQueryResult(value: unknown): unknown {
    if (typeof value === 'bigint') {
      return this.normalizeBigInt(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeQueryResult(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.normalizeQueryResult(item)]),
      );
    }

    return value;
  }

  private normalizeBigInt(value: bigint) {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }
}
