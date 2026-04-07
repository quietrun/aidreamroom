import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { LegacyDbService } from '../database/legacy-db.service';
import { SessionUser } from './session-user.interface';

@Injectable()
export class SessionAuthService {
  private static readonly SESSION_TTL_MS = 15 * 24 * 60 * 60 * 1000;

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

    const user = await this.db.findFirst<SessionUser>(
      'select uuid, email, token, updateTime, accountType from user_table where token = ?',
      [token],
    );

    return user;
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

    await this.db.execute('update user_table set updateTime = ? where uuid = ?', [
      Date.now(),
      user.uuid,
    ]);

    return { valid: true, id: user.uuid };
  }
}
