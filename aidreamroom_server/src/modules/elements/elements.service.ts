import { Injectable } from '@nestjs/common';

import { LegacyDbService } from '../../common/database/legacy-db.service';
import { generateUuid } from '../../common/utils/id.util';
import { normalizeTimestamp } from '../../common/utils/number.util';

@Injectable()
export class ElementsService {
  constructor(private readonly db: LegacyDbService) {}

  async create(
    creatorId: string,
    payload: {
      name: string;
      descript?: string;
      worldType?: string | number;
      type?: number;
      images?: string;
      parent?: string;
      materialType?: number;
      isShared?: boolean;
    },
  ) {
    const data = {
      uuid: generateUuid(),
      creator: creatorId,
      createTime: normalizeTimestamp(),
      updateTime: normalizeTimestamp(),
      name: payload.name,
      descript: payload.descript ?? '',
      worldType: payload.worldType?.toString() ?? '',
      type: payload.type ?? 0,
      images: payload.images ?? '',
      parent: payload.parent ?? '',
      materialType: payload.materialType ?? 0,
      isShared: payload.isShared ?? false,
      isDelete: false,
    };

    await this.db.replaceInto('element_item_table', data);
    return data;
  }

  async update(payload: Record<string, unknown>) {
    const current = await this.db.findFirst<Record<string, unknown>>(
      'select * from element_item_table where uuid = ?',
      [String(payload.uuid ?? '')],
    );
    const data = {
      ...(current ?? {}),
      ...payload,
      updateTime: normalizeTimestamp(),
    };
    await this.db.replaceInto('element_item_table', data);
    return data;
  }

  async softDelete(ids: string[]) {
    for (const uuid of ids) {
      await this.db.execute('update element_item_table set isDelete = ? where uuid = ?', [
        true,
        uuid,
      ]);
    }
  }

  listByCreator(creatorId: string) {
    return this.db.query(
      'select * from element_item_table where creator = ? order by updateTime desc',
      [creatorId],
    );
  }

  listNotMine(creatorId: string) {
    return this.db.query(
      'select * from element_item_table where creator != ? and isDelete = ? order by updateTime desc',
      [creatorId, false],
    );
  }

  listShared(creatorId: string) {
    return this.db.query(
      'select * from element_item_table where creator != ? and isShared = ? order by updateTime desc',
      [creatorId, true],
    );
  }

  async updateHiddenItems(userId: string, itemIds: string[], isHide: boolean) {
    if (isHide) {
      for (const itemId of itemIds) {
        await this.db.replaceInto('hidden_item_table', { userId, itemId });
      }
      return;
    }

    for (const itemId of itemIds) {
      await this.db.execute('delete from hidden_item_table where userId = ? and itemId = ?', [
        userId,
        itemId,
      ]);
    }
  }

  async updateCart(userId: string, itemIds: string[]) {
    await this.db.execute('delete from metrial_cart_table where userId = ?', [userId]);
    for (const itemId of itemIds) {
      await this.db.replaceInto('metrial_cart_table', { userId, itemId });
    }
  }

  async queryHiddenItems(userId: string) {
    const rows = await this.db.query<{ itemId: string }>(
      'select itemId from hidden_item_table where userId = ?',
      [userId],
    );
    return rows.map((row) => row.itemId);
  }

  async importItems(creatorId: string, ids: string[]) {
    await this.importRecursive(ids, '', creatorId);
  }

  // 递归复制元素树，保证导入后父子层级仍然正确。
  private async importRecursive(ids: string[], parent: string, creatorId: string) {
    if (ids.length === 0) {
      return;
    }

    const inClause = this.db.buildInClause(ids);
    const items = await this.db.query<Record<string, unknown>>(
      `select * from element_item_table where uuid in (${inClause.sql})`,
      inClause.params,
    );

    for (const item of items) {
      const newId = generateUuid();
      await this.db.replaceInto('element_item_table', {
        ...item,
        uuid: newId,
        creator: creatorId,
        parent,
        createTime: normalizeTimestamp(),
        updateTime: normalizeTimestamp(),
      });

      const children = await this.db.query<{ uuid: string }>(
        'select uuid from element_item_table where parent = ?',
        [String(item.uuid)],
      );
      if (children.length > 0) {
        await this.importRecursive(
          children.map((child) => child.uuid),
          newId,
          creatorId,
        );
      }
    }
  }
}
