import { Injectable } from '@nestjs/common';

import { LegacyDbService } from '../../common/database/legacy-db.service';
import { generateUuid } from '../../common/utils/id.util';
import { normalizeTimestamp } from '../../common/utils/number.util';

@Injectable()
export class PlotsService {
  constructor(private readonly db: LegacyDbService) {}

  async create(
    creatorId: string,
    payload: {
      title: string;
      descript?: string;
      worldType?: string | number;
      plotTarget?: string;
    },
  ) {
    const now = normalizeTimestamp();
    const uuid = generateUuid();
    await this.db.replaceInto('plot_info_table', {
      uuid,
      creator: creatorId,
      updateTime: now,
      title: payload.title,
      descript: payload.descript ?? '',
      worldType: payload.worldType?.toString() ?? '',
      plotTarget: payload.plotTarget ?? '随意探索',
    });

    await this.db.replaceInto('plot_item_table', {
      uuid: generateUuid(),
      parent: uuid,
      title: '导入信息',
      descript: '',
      updateTime: now,
      images: '',
      creator: creatorId,
      type: 0,
      plotParent: uuid,
      conditionIds: '',
      plotType: 0,
    });

    return {
      uuid,
      creator: creatorId,
      updateTime: now,
      title: payload.title,
      descript: payload.descript ?? '',
      worldType: payload.worldType?.toString() ?? '',
      plotTarget: payload.plotTarget ?? '随意探索',
    };
  }

  queryItem(uuid: string) {
    return this.db.findFirst('select * from plot_info_table where uuid = ?', [uuid]);
  }

  async update(payload: Record<string, unknown>) {
    const current = await this.db.findFirst<Record<string, unknown>>(
      'select * from plot_info_table where uuid = ?',
      [String(payload.uuid ?? '')],
    );
    const plot = {
      ...(current ?? {}),
      ...payload,
      updateTime: normalizeTimestamp(),
    };
    await this.db.replaceInto('plot_info_table', plot);
    return plot;
  }

  async createBranch(
    creatorId: string,
    payload: {
      parent?: string;
      title?: string;
      descript?: string;
      conditionIds?: string;
      images?: string;
      isSub?: boolean;
      subParentId?: string;
      plotType?: number;
      metrics?: string;
    },
  ) {
    const branch = {
      uuid: generateUuid(),
      parent: payload.parent ?? '',
      title: payload.title ?? '',
      descript: payload.descript ?? '',
      updateTime: normalizeTimestamp(),
      images: payload.images ?? '',
      creator: creatorId,
      type: 0,
      plotParent: '',
      conditionIds: payload.conditionIds ?? '',
      isSub: payload.isSub ?? false,
      subParentId: payload.subParentId ?? '',
      plotType: payload.plotType ?? 0,
      metrics: payload.metrics ?? '',
    };
    await this.db.replaceInto('plot_item_table', branch);
    return branch;
  }

  async queryBranch(uuid: string) {
    const branch = await this.db.findFirst<Record<string, unknown>>(
      'select * from plot_item_table where uuid = ?',
      [uuid],
    );

    const conditionIds = String(branch?.conditionIds ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    let elements: Record<string, unknown>[] = [];
    if (conditionIds.length > 0) {
      const inClause = this.db.buildInClause(conditionIds);
      elements = await this.db.query(
        `select * from element_item_table where uuid in (${inClause.sql})`,
        inClause.params,
      );
    }

    return { branch, elements };
  }

  async updateBranch(payload: Record<string, unknown>) {
    const current = await this.db.findFirst<Record<string, unknown>>(
      'select * from plot_item_table where uuid = ?',
      [String(payload.uuid ?? '')],
    );
    const branch = {
      ...(current ?? {}),
      ...payload,
      updateTime: normalizeTimestamp(),
    };
    await this.db.replaceInto('plot_item_table', branch);
    return branch;
  }

  queryBranchList(parent: string) {
    return this.db.query('select * from plot_item_table where parent = ?', [parent]);
  }

  queryKnowledgeList(parent: string) {
    return this.db.query('select * from plot_knowledge_table where parent = ?', [parent]);
  }

  async deleteKnowledge(ids: string[]) {
    for (const id of ids) {
      await this.db.execute('delete from plot_knowledge_table where uuid = ?', [id]);
    }
  }

  async createKnowledge(payload: Record<string, unknown>) {
    const knowledge = {
      ...payload,
      uuid: generateUuid(),
    };
    await this.db.replaceInto('plot_knowledge_table', knowledge);
    return knowledge;
  }

  async updateKnowledge(payload: Record<string, unknown>) {
    const current = await this.db.findFirst<Record<string, unknown>>(
      'select * from plot_knowledge_table where uuid = ?',
      [String(payload.uuid ?? '')],
    );
    const data = {
      ...(current ?? {}),
      ...payload,
    };
    await this.db.replaceInto('plot_knowledge_table', data);
    return data;
  }

  async createItem(
    creatorId: string,
    payload: { plotId?: string; title: string; type?: number; descript?: string; images?: string },
  ) {
    const item = {
      uuid: generateUuid(),
      parent: payload.plotId ?? '',
      title: payload.title,
      descript: payload.descript ?? '',
      updateTime: normalizeTimestamp(),
      images: payload.images ?? '',
      creator: creatorId,
      type: payload.type ?? 0,
      plotParent: '',
      conditionIds: '',
    };
    await this.db.replaceInto('plot_item_table', item);
    return item;
  }

  editPlot(payload: { uuid: string; title: string; descript?: string; worldType?: string | number }) {
    return this.db.execute(
      'update plot_info_table set updateTime = ?, title = ?, descript = ?, worldType = ? where uuid = ?',
      [
        normalizeTimestamp(),
        payload.title,
        payload.descript ?? '',
        payload.worldType?.toString() ?? '',
        payload.uuid,
      ],
    );
  }

  async recordPositions(list: Array<{ uuid?: string; x?: number; y?: number; itemId?: string }>) {
    for (const item of list) {
      await this.db.replaceInto('plot_position_table', {
        uuid: item.uuid ?? generateUuid(),
        x: item.x ?? 0,
        y: item.y ?? 0,
        itemId: item.itemId ?? '',
      });
    }
  }

  async queryPositions(list: Array<{ itemId: string }>) {
    const ids = list.map((item) => item.itemId).filter(Boolean);
    if (ids.length === 0) {
      return [];
    }
    const inClause = this.db.buildInClause(ids);
    return this.db.query(
      `select * from plot_position_table where itemId in (${inClause.sql})`,
      inClause.params,
    );
  }

  async editItem(
    creatorId: string,
    payload: { plotId?: string; itemId?: string; title: string; type?: number; descript?: string; images?: string },
  ) {
    const current = await this.db.findFirst<Record<string, unknown>>(
      'select * from plot_item_table where uuid = ?',
      [payload.itemId ?? ''],
    );
    const item = {
      ...(current ?? {}),
      uuid: payload.itemId ?? generateUuid(),
      parent: payload.plotId ?? current?.parent ?? '',
      title: payload.title,
      descript: payload.descript ?? '',
      updateTime: normalizeTimestamp(),
      images: payload.images ?? current?.images ?? '',
      creator: creatorId,
      type: payload.type ?? current?.type ?? 0,
    };
    await this.db.replaceInto('plot_item_table', item);
    return item;
  }

  editBranchParent(uuid: string, plotParent: string) {
    return this.db.execute('update plot_item_table set plotParent = ? where uuid = ?', [plotParent, uuid]);
  }

  editCondition(uuid: string, conditionIds: string) {
    return this.db.execute('update plot_item_table set conditionIds = ? where uuid = ?', [conditionIds, uuid]);
  }

  removeItemSub(id: string) {
    return this.db.execute('delete from plot_item_table where isSub = ? and subParentId = ?', [true, id]);
  }

  async removeItems(ids: string[]) {
    if (ids.length === 0) {
      return;
    }

    const first = await this.db.findFirst<{ parent: string }>(
      'select parent from plot_item_table where uuid = ?',
      [ids[0]],
    );
    if (first?.parent) {
      const list = await this.db.query<{ uuid: string; conditionIds: string }>(
        'select * from plot_item_table where parent = ? and type = ?',
        [first.parent, 0],
      );
      for (const item of list) {
        const merged = new Set(
          String(item.conditionIds ?? '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        );
        for (const id of ids) {
          merged.delete(id);
        }
        await this.db.execute('update plot_item_table set conditionIds = ? where uuid = ?', [
          Array.from(merged).join(','),
          item.uuid,
        ]);
      }
    }

    for (const id of ids) {
      await this.db.execute('delete from plot_item_table where uuid = ?', [id]);
    }
  }

  listByCreator(creatorId: string) {
    return this.db.query(
      'select * from plot_info_table where creator = ? order by updateTime desc',
      [creatorId],
    );
  }

  listAll() {
    return this.db.query('select * from plot_info_table order by updateTime desc');
  }

  listItems(plotId: string) {
    return this.db.query('select * from plot_item_table where parent = ?', [plotId]);
  }
}
