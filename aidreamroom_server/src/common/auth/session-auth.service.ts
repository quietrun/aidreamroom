import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { LegacyDbService } from '../database/legacy-db.service';
import { SessionUser } from './session-user.interface';

@Injectable()
export class SessionAuthService {
  private static readonly SESSION_TTL_MS = 15 * 24 * 60 * 60 * 1000;
  private static readonly USER_CACHE_TTL_MS = 5 * 1000;
  private static readonly SESSION_TOUCH_INTERVAL_MS = 10 * 60 * 1000;

  private readonly userCache = new Map<
    string,
    {
      user: SessionUser | null;
      expiresAt: number;
    }
  >();
  private readonly sessionTouchCache = new Map<string, number>();

  constructor(private readonly db: LegacyDbService) {}

  async requireUserByToken(token: string | undefined): Promise<SessionUser> {
    if (!token) {
      throw new UnauthorizedException('缺少 session_token');
    }

    const user = await this.getUserByToken(token);
    if (!user) {
      throw new UnauthorizedException('登录状态失效');
    }

    return user;
  }

  async getUserByToken(token: string | undefined): Promise<SessionUser | null> {
    if (!token) {
      return null;
    }

    const now = Date.now();
    const cached = this.userCache.get(token);
    if (cached && cached.expiresAt > now) {
      return cached.user;
    }

    const user = await this.db.findFirst<SessionUser>(
      'select uuid, email, token, updateTime, accountType from user_table where token = ?',
      [token],
    );

    const normalizedUser = user
      ? {
          ...user,
          updateTime: Number(user.updateTime || 0),
          accountType: Number(user.accountType || 0),
        }
      : null;

    this.userCache.set(token, {
      user: normalizedUser,
      expiresAt: now + SessionAuthService.USER_CACHE_TTL_MS,
    });

    return normalizedUser;
  }

  async getUserIdByToken(token: string | undefined): Promise<string | null> {
    const user = await this.getUserByToken(token);
    return user?.uuid ?? null;
  }

  async checkToken(token: string | undefined) {
    const user = await this.getUserByToken(token);
    if (!user) {
      return { valid: false, id: '' };
    }

    const expired =
      Date.now() - Number(user.updateTime || 0) >=
      SessionAuthService.SESSION_TTL_MS;

    if (expired) {
      return { valid: false, id: '' };
    }

    const now = Date.now();
    const lastTouchedAt = this.sessionTouchCache.get(user.uuid) ?? 0;
    if (now - lastTouchedAt >= SessionAuthService.SESSION_TOUCH_INTERVAL_MS) {
      await this.db.execute('update user_table set updateTime = ? where uuid = ?', [
        now,
        user.uuid,
      ]);
      this.sessionTouchCache.set(user.uuid, now);
      this.userCache.set(token!, {
        user: {
          ...user,
          updateTime: now,
        },
        expiresAt: now + SessionAuthService.USER_CACHE_TTL_MS,
      });
    }

    return { valid: true, id: user.uuid };
  }
}
