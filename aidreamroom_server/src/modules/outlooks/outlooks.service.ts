import { Injectable } from '@nestjs/common';

import { LegacyDbService } from '../../common/database/legacy-db.service';
import { generateUuid } from '../../common/utils/id.util';
import { normalizeTimestamp } from '../../common/utils/number.util';

@Injectable()
export class OutlooksService {
  constructor(private readonly db: LegacyDbService) {}

  async create(
    creatorId: string,
    payload: { title: string; descript?: string; worldType?: string | number },
  ) {
    const uuid = generateUuid();
    await this.db.replaceInto('outlook_info_table', {
      uuid,
      creator: creatorId,
      updateTime: normalizeTimestamp(),
      title: payload.title,
      descript: payload.descript ?? '',
      worldType: payload.worldType?.toString() ?? '',
    });
    return uuid;
  }

  async update(payload: {
    uuid?: string;
    title: string;
    descript?: string;
    worldType?: string | number;
  }) {
    await this.db.execute(
      'update outlook_info_table set title = ?, descript = ?, worldType = ? where uuid = ?',
      [payload.title, payload.descript ?? '', payload.worldType?.toString() ?? '', payload.uuid ?? ''],
    );
  }

  queryItem(uuid: string) {
    return this.db.findFirst('select * from outlook_info_table where uuid = ?', [uuid]);
  }

  async createItem(
    creatorId: string,
    payload: { outlookId?: string; title: string; type?: number; descript?: string; images?: string },
  ) {
    const item = {
      uuid: generateUuid(),
      parent: payload.outlookId ?? '',
      title: payload.title,
      descript: payload.descript ?? '',
      updateTime: normalizeTimestamp(),
      images: payload.images ?? '',
      creator: creatorId,
      type: payload.type ?? 0,
    };
    await this.db.replaceInto('outlook_item_table', item);
    return item;
  }

  async editItem(
    creatorId: string,
    payload: {
      itemId?: string;
      outlookId?: string;
      title: string;
      type?: number;
      descript?: string;
      images?: string;
    },
  ) {
    const item = {
      uuid: payload.itemId ?? generateUuid(),
      parent: payload.outlookId ?? '',
      title: payload.title,
      descript: payload.descript ?? '',
      updateTime: normalizeTimestamp(),
      images: payload.images ?? '',
      creator: creatorId,
      type: payload.type ?? 0,
    };
    await this.db.replaceInto('outlook_item_table', item);
    return item;
  }

  async removeItems(ids: string[]) {
    for (const id of ids) {
      await this.db.execute('delete from outlook_item_table where uuid = ?', [id]);
    }
  }

  listByCreator(creatorId: string) {
    return this.db.query(
      'select * from outlook_info_table where creator = ? order by updateTime desc',
      [creatorId],
    );
  }

  listAll() {
    return this.db.query('select * from outlook_info_table order by updateTime desc');
  }

  listItems(outlookId: string) {
    return this.db.query('select * from outlook_item_table where parent = ?', [outlookId]);
  }
}
