import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const DEFAULT_CONNECTION_LIMIT = '5';
const DEFAULT_POOL_TIMEOUT_SECONDS = '15';

function buildDatasourceUrl() {
  const rawUrl = process.env.DATABASE_URL ?? '';

  if (!rawUrl) {
    return rawUrl;
  }

  try {
    const url = new URL(rawUrl);

    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set(
        'connection_limit',
        process.env.PRISMA_CONNECTION_LIMIT ?? DEFAULT_CONNECTION_LIMIT,
      );
    }

    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set(
        'pool_timeout',
        process.env.PRISMA_POOL_TIMEOUT ?? DEFAULT_POOL_TIMEOUT_SECONDS,
      );
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      datasources: {
        db: {
          url: buildDatasourceUrl(),
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
