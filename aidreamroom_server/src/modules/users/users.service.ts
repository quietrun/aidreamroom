import { Injectable } from '@nestjs/common';

import { SessionAuthService } from '../../common/auth/session-auth.service';
import { LegacyDbService } from '../../common/database/legacy-db.service';
import { generateNumericId, generateUuid } from '../../common/utils/id.util';
import { ERROR_CODE } from '../../common/utils/legacy.constants';
import { isChinesePhoneNumber } from '../../common/utils/phone.util';
import { EmailService } from '../notifications/email.service';
import { SmsService } from '../notifications/sms.service';

@Injectable()
export class UsersService {
  private readonly abandonedAccounts = ['0923567937', '15910931773', ''];

  constructor(
    private readonly db: LegacyDbService,
    private readonly sessionAuthService: SessionAuthService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  async checkEmailExists(email: string) {
    const row = await this.db.findFirst('select * from user_table where email = ?', [email]);
    return Boolean(row);
  }

  async sendEmailCode(email: string, type: number, accountType: number) {
    const exists = await this.checkEmailExists(email);
    if (type === 0 && exists) {
      return { result: -1, msgId: ERROR_CODE.EmailExist };
    }

    if (type === 1 && !exists) {
      return { result: -1, msgId: ERROR_CODE.EmailNotExist };
    }

    const cached = await this.db.findFirst<{ limitTime: number }>(
      'select * from email_code_table where email = ?',
      [email],
    );
    if (cached && Number(cached.limitTime) - 1000 * 60 * 4 > Date.now()) {
      return { result: -1, msgId: ERROR_CODE.PhoneCodeTimeLimit };
    }

    try {
      const code = accountType === 0
        ? await this.emailService.sendVerifyCode(email)
        : await this.smsService.sendVerifyCode(email);
      await this.db.replaceInto('email_code_table', {
        email,
        code,
        limitTime: Date.now() + 1000 * 60 * 5,
      });
      return { result: 0 };
    } catch {
      return { result: -1, msgId: ERROR_CODE.PhoneCodeSendFailed };
    }
  }

  async login(email: string, password: string, recordUser: boolean) {
    const user = await this.db.findFirst<Record<string, unknown>>(
      'select * from user_table where email = ?',
      [email],
    );
    if (!user) {
      return { result: -1, msgId: ERROR_CODE.EmailNotExist };
    }
    if (String(user.password ?? '') !== password) {
      return { result: -1, msgId: ERROR_CODE.PasswordError };
    }

    const token = generateUuid();
    await this.db.execute('update user_table set token = ?, updateTime = ? where email = ?', [
      token,
      recordUser ? Date.now() : 0,
      email,
    ]);

    return { result: 0, token };
  }

  async register(email: string, password: string, code: string, accountType: number) {
    const record = await this.db.findFirst<{ status: number }>(
      'select * from user_register_table where account = ?',
      [email],
    );
    if (!record || Number(record.status) === 0) {
      return { result: -1 };
    }

    const validCode = await this.checkEmailCode(email, code);
    if (!validCode) {
      return {
        result: -1,
        msgId: accountType === 0 ? ERROR_CODE.EmailCodeError : ERROR_CODE.PhoneCodeError,
      };
    }

    const token = generateUuid();
    const uuid = generateUuid();
    await this.db.replaceInto('user_table', {
      email,
      password,
      token,
      uuid,
      updateTime: Date.now(),
      level: 0,
      vip: 0,
      accountType,
      createTime: Date.now(),
    });

    return { result: 0, token };
  }

  async editPassword(email: string, password: string, code: string) {
    const validCode = await this.checkEmailCode(email, code);
    if (!validCode) {
      return { result: -1, msgId: ERROR_CODE.EmailCodeError };
    }

    const token = generateUuid();
    await this.db.execute('update user_table set password = ?, token = ? where email = ?', [
      password,
      token,
      email,
    ]);
    return { result: 0, token };
  }

  checkToken(token?: string) {
    return this.sessionAuthService.checkToken(token);
  }

  getUserIdByToken(token?: string) {
    return this.sessionAuthService.getUserIdByToken(token);
  }

  async addLiked(userId: string, itemId: string, itemType: number) {
    await this.db.replaceInto('user_like_table', {
      userId,
      itemId,
      itemType,
      liked: true,
      focused: true,
    });
  }

  removeLiked(userId: string, itemId: string) {
    return this.db.execute('delete from user_like_table where userId = ? and itemId = ?', [userId, itemId]);
  }

  queryLikedList(userId: string) {
    return this.db.query('select * from user_like_table where userId = ?', [userId]);
  }

  async applyRegister(account: string) {
    const current = await this.db.findFirst('select * from user_register_table where account = ?', [account]);
    if (current) {
      return { result: 1 };
    }

    await this.db.replaceInto('user_register_table', {
      account,
      uuid: generateUuid(),
      createTime: Date.now(),
      status: 0,
    });
    return { result: 0 };
  }

  async checkInRegisterList(account: string) {
    const current = await this.db.findFirst<{ status: number }>(
      'select * from user_register_table where account = ?',
      [account],
    );
    return { result: current ? Number(current.status) : 0 };
  }

  async releaseRegister(count: number) {
    const list = await this.db.query<Record<string, unknown>>('select * from user_register_table');
    const pending = list
      .sort((a, b) => Number(a.createTime ?? 0) - Number(b.createTime ?? 0))
      .filter((item) => Number(item.status ?? 0) === 0)
      .filter((item) => !this.abandonedAccounts.includes(String(item.account ?? '')));

    const target = count > 0 ? pending.slice(0, count) : pending;
    for (const item of target) {
      await this.db.execute('update user_register_table set status = ? where account = ?', [
        1,
        String(item.account ?? ''),
      ]);
    }

    return { result: 0, list: target };
  }

  async checkHasUserInfo(userId: string) {
    const current = await this.db.findFirst('select * from user_info_table where uuid = ?', [userId]);
    return Boolean(current);
  }

  async queryOrCreateUserInfo(userId: string) {
    const current = await this.db.findFirst<Record<string, unknown>>(
      'select * from user_info_table where uuid = ?',
      [userId],
    );
    if (current) {
      return current;
    }

    const user = await this.db.findFirst<{ email: string }>('select * from user_table where uuid = ?', [userId]);
    const account = user?.email ?? '';
    const usedIds = await this.db.query<{ user_id: string }>('select * from user_info_table');
    const existingIds = new Set(usedIds.map((item) => item.user_id));

    let userIdText = generateNumericId(12);
    while (existingIds.has(userIdText)) {
      userIdText = generateNumericId(12);
    }

    const result = {
      uuid: userId,
      user_id: userIdText,
      user_name: `新玩家${Date.now()}`,
      user_phone: isChinesePhoneNumber(account) ? account : '',
      user_email: isChinesePhoneNumber(account) ? '' : account,
      user_avater: '',
    };
    await this.db.replaceInto('user_info_table', result);
    return result;
  }

  async queryMoreDetail(userId: string, sharedOnly: boolean) {
    const playSql = sharedOnly
      ? 'select * from play_config where creator = ? and plot_id in (select script_id from play_runtime_table)'
      : 'select * from play_config where creator = ?';
    const play = await this.db.query(playSql, [userId]);
    return { play };
  }

  async checkUserNameRepeat(userName: string) {
    const current = await this.db.findFirst('select * from user_info_table where user_name = ?', [userName]);
    return !current;
  }

  async queryFriends(userId: string) {
    const list = await this.db.query<Array<Record<string, unknown>>>(
      'select * from friends_table where user_id = ? or target_user_id = ?',
      [userId, userId],
    ) as unknown as Array<Record<string, unknown>>;
    const detailIds = list
      .map((item) => (String(item.user_id) === userId ? String(item.target_user_id) : String(item.user_id)))
      .filter(Boolean);
    const detailRows = await this.queryRowsByIds('user_info_table', detailIds);
    const detailMap = new Map(detailRows.map((item) => [String((item as Record<string, unknown>).uuid ?? ''), item]));

    return list.map((item) => {
      const sourceId = String(item.user_id ?? '');
      const targetId = String(item.target_user_id ?? '');
      return {
        ...item,
        ...(detailMap.get(sourceId) ?? {}),
        ...(detailMap.get(targetId) ?? {}),
      };
    });
  }

  updateInfo(payload: Record<string, unknown>) {
    return this.db.replaceInto('user_info_table', payload);
  }

  async addFriend(userId: string, targetUserId: string) {
    const reversed = await this.db.findFirst<{ status: number }>(
      'select * from friends_table where user_id = ? and target_user_id = ?',
      [targetUserId, userId],
    );

    if (!reversed || Number(reversed.status) === 2) {
      await this.db.replaceInto('friends_table', {
        target_user_id: targetUserId,
        user_id: userId,
        has_read: false,
        status: 0,
      });
    }
  }

  readAllNotes(userId: string) {
    return this.db.execute('update friends_table set has_read = ? where target_user_id = ?', [true, userId]);
  }

  updateFriend(targetUserId: string, userId: string, approval: boolean) {
    return this.db.execute('update friends_table set status = ? where target_user_id = ? and user_id = ?', [
      approval ? 1 : 2,
      targetUserId,
      userId,
    ]);
  }

  queryUserByName(userName: string) {
    return this.db.query('select * from user_info_table where user_name = ?', [userName]);
  }

  queryInfoByUserId(userId: string) {
    return this.db.findFirst('select * from user_info_table where uuid = ?', [userId]);
  }

  async sendAccountVerifyCode(account: string) {
    const cached = await this.db.findFirst<{ limitTime: number }>(
      'select * from email_code_table where email = ?',
      [account],
    );
    if (cached && Number(cached.limitTime) - 1000 * 60 * 4 > Date.now()) {
      throw new Error(String(ERROR_CODE.PhoneCodeTimeLimit));
    }

    const code = isChinesePhoneNumber(account)
      ? await this.smsService.sendVerifyCode(account)
      : await this.emailService.sendVerifyCode(account);
    await this.db.replaceInto('email_code_table', {
      email: account,
      code,
      limitTime: Date.now() + 1000 * 60 * 5,
    });
    return code;
  }

  private async checkEmailCode(email: string, code: string) {
    const record = await this.db.findFirst<{ limitTime: number }>(
      'select * from email_code_table where email = ? and code = ?',
      [email, code],
    );
    return Boolean(record && Number(record.limitTime) >= Date.now());
  }

  private async queryRowsByIds(table: string, ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    const inClause = this.db.buildInClause(ids);
    return this.db.query(`select * from ${table} where uuid in (${inClause.sql})`, inClause.params);
  }
}
