import { Injectable } from '@nestjs/common';

import { LegacyDbService } from '../../common/database/legacy-db.service';
import { generateUuid } from '../../common/utils/id.util';

@Injectable()
export class NumericalService {
  constructor(private readonly db: LegacyDbService) {}

  async update(payload: Record<string, unknown>) {
    const current = await this.db.findFirst<Record<string, unknown>>(
      'select * from numerical_value_table where uuid = ?',
      [String(payload.uuid)],
    );
    await this.db.replaceInto('numerical_value_table', {
      ...(current ?? {}),
      ...payload,
    });
  }

  async create(payload: Record<string, unknown>) {
    await this.db.replaceInto('numerical_value_table', {
      uuid: payload.uuid ? String(payload.uuid) : generateUuid(),
      ...payload,
    });
  }

  queryAll() {
    return this.db.query('select * from numerical_value_table');
  }

  delete(uuid: string) {
    return this.db.execute('delete from numerical_value_table where uuid = ?', [uuid]);
  }

  async copy(uuid: string) {
    const current = await this.db.findFirst<Record<string, unknown>>(
      'select * from numerical_value_table where uuid = ?',
      [uuid],
    );
    if (!current) {
      return;
    }

    await this.db.replaceInto('numerical_value_table', {
      ...current,
      uuid: generateUuid(),
    });
  }

  async queryOnlineType() {
    return this.db.findFirst('select * from numerical_value_table where inUsed = ?', [1]);
  }
}
