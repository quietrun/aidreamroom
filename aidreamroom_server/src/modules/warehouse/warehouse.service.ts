import { Injectable } from '@nestjs/common';

import { LegacyDbService } from '../../common/database/legacy-db.service';
import { generateUuid } from '../../common/utils/id.util';
import { normalizeTimestamp } from '../../common/utils/number.util';
import { ItemAffix, computeWeaponBreakRisk } from '../items/items.constants';
import { ItemsService } from '../items/items.service';
import { SkillsService } from '../skills/skills.service';
import {
  DEFAULT_WAREHOUSE_CAPACITY,
  DEFAULT_WAREHOUSE_EXPAND_AMOUNT,
  DEFAULT_WAREHOUSE_STARTER_ENTRIES,
  WarehouseEntryType,
  clampWarehouseCapacity,
  clampWarehouseExpandAmount,
  clampWarehouseQuantity,
} from './warehouse.constants';

type WarehouseRecord = {
  uuid: string;
  user_id: string;
  capacity: number | null;
  expansion_count: number | null;
  createTime: number | null;
  updateTime: number | null;
};

type WarehouseEntryRow = {
  uuid: string;
  warehouse_id: string;
  entry_type: string;
  item_id: string | null;
  skill_id: string | null;
  quantity: number | null;
  remaining_uses: number | null;
  durability_current: number | null;
  durability_max: number | null;
  is_equipped: boolean | null;
  equipped_slot: string | null;
  affix_config: string | null;
  createTime: number | null;
  updateTime: number | null;
};

type StoreWarehousePayload = {
  entryType?: string;
  itemId?: string;
  skillId?: string;
  quantity?: number;
  remainingUses?: number;
  durabilityCurrent?: number;
  durabilityMax?: number;
  isEquipped?: boolean;
  equippedSlot?: string;
  affixConfig?: unknown;
};

type SkillDetailResponse = NonNullable<Awaited<ReturnType<SkillsService['queryDetailByUser']>>>;

@Injectable()
export class WarehouseService {
  constructor(
    private readonly db: LegacyDbService,
    private readonly itemsService: ItemsService,
    private readonly skillsService: SkillsService,
  ) {}

  async queryProfile(userId: string) {
    const warehouse = await this.ensureWarehouse(userId);
    const entries = await this.queryEntries(warehouse.uuid);
    const [itemList, skillCards] = await Promise.all([
      this.itemsService.queryListByUser(userId),
      this.querySkillCardMap(userId, entries),
    ]);
    const itemMap = new Map(itemList.map((item) => [item.uuid, item]));

    const normalizedEntries = entries.map((row) => this.buildEntryResponse(row, itemMap, skillCards));
    const capacity = clampWarehouseCapacity(Number(warehouse.capacity ?? DEFAULT_WAREHOUSE_CAPACITY));

    return {
      warehouseId: warehouse.uuid,
      capacity,
      expansionCount: Math.max(0, Number(warehouse.expansion_count ?? 0)),
      usedSlots: normalizedEntries.length,
      freeSlots: Math.max(0, capacity - normalizedEntries.length),
      nextExpandAmount: DEFAULT_WAREHOUSE_EXPAND_AMOUNT,
      entries: normalizedEntries,
      createTime: Number(warehouse.createTime ?? 0),
      updateTime: Number(warehouse.updateTime ?? 0),
    };
  }

  async expandWarehouse(userId: string, amount: number) {
    const warehouse = await this.ensureWarehouse(userId);
    const nextAmount = clampWarehouseExpandAmount(amount);
    const nextCapacity = clampWarehouseCapacity(
      Number(warehouse.capacity ?? DEFAULT_WAREHOUSE_CAPACITY) + nextAmount,
    );
    const now = normalizeTimestamp();

    await this.db.execute(
      'update user_warehouse_table set capacity = ?, expansion_count = ?, updateTime = ? where uuid = ?',
      [nextCapacity, Math.max(0, Number(warehouse.expansion_count ?? 0)) + 1, now, warehouse.uuid],
    );

    return this.queryProfile(userId);
  }

  async storeEntry(userId: string, payload: StoreWarehousePayload) {
    const warehouse = await this.ensureWarehouse(userId);
    const currentProfile = await this.queryProfile(userId);
    if (currentProfile.usedSlots >= currentProfile.capacity) {
      return null;
    }

    const entryType: WarehouseEntryType = payload.entryType === 'skill_card' ? 'skill_card' : 'item';
    const now = normalizeTimestamp();
    const affixConfig = this.parseAffixConfig(payload.affixConfig);

    await this.db.replaceInto('user_warehouse_entry_table', {
      uuid: generateUuid(),
      warehouse_id: warehouse.uuid,
      entry_type: entryType,
      item_id: entryType === 'item' ? payload.itemId ?? '' : null,
      skill_id: entryType === 'skill_card' ? payload.skillId ?? '' : null,
      quantity: clampWarehouseQuantity(Number(payload.quantity ?? 1)),
      remaining_uses: payload.remainingUses ?? null,
      durability_current: payload.durabilityCurrent ?? null,
      durability_max: payload.durabilityMax ?? null,
      is_equipped: payload.isEquipped ?? false,
      equipped_slot: payload.equippedSlot ?? '',
      affix_config: affixConfig.length ? JSON.stringify(affixConfig) : null,
      createTime: now,
      updateTime: now,
    });

    return this.queryProfile(userId);
  }

  async discardEntry(userId: string, entryId: string, quantity = 1) {
    const warehouse = await this.ensureWarehouse(userId);
    const row = await this.db.findFirst<WarehouseEntryRow>(
      'select * from user_warehouse_entry_table where uuid = ? and warehouse_id = ?',
      [entryId, warehouse.uuid],
    );

    if (!row) {
      return null;
    }

    const nextQuantity = Math.max(0, Number(row.quantity ?? 1) - clampWarehouseQuantity(quantity));
    if (nextQuantity <= 0) {
      await this.db.execute('delete from user_warehouse_entry_table where uuid = ?', [entryId]);
    } else {
      await this.db.execute(
        'update user_warehouse_entry_table set quantity = ?, updateTime = ? where uuid = ?',
        [nextQuantity, normalizeTimestamp(), entryId],
      );
    }

    return this.queryProfile(userId);
  }

  private async ensureWarehouse(userId: string) {
    await Promise.all([this.itemsService.ensureCatalog(), this.skillsService.ensureCatalog()]);

    const current = await this.findWarehouseRowByUserId(userId);
    if (current) {
      return current;
    }

    const now = normalizeTimestamp();
    const warehouseId = generateUuid();

    await this.db.replaceInto('user_warehouse_table', {
      uuid: warehouseId,
      user_id: userId,
      capacity: DEFAULT_WAREHOUSE_CAPACITY,
      expansion_count: 0,
      createTime: now,
      updateTime: now,
    });

    for (const seed of DEFAULT_WAREHOUSE_STARTER_ENTRIES) {
      await this.db.replaceInto('user_warehouse_entry_table', {
        uuid: generateUuid(),
        warehouse_id: warehouseId,
        entry_type: seed.entryType,
        item_id: seed.itemId ?? null,
        skill_id: seed.skillId ?? null,
        quantity: seed.quantity,
        remaining_uses: seed.remainingUses ?? null,
        durability_current: seed.durabilityCurrent ?? null,
        durability_max: seed.durabilityMax ?? null,
        is_equipped: seed.isEquipped ?? false,
        equipped_slot: seed.equippedSlot ?? '',
        affix_config: seed.affixConfig?.length ? JSON.stringify(seed.affixConfig) : null,
        createTime: now,
        updateTime: now,
      });
    }

    const created = await this.findWarehouseRowByUserId(userId);
    if (!created) {
      throw new Error('warehouse create failed');
    }

    return created;
  }

  private async querySkillCardMap(userId: string, rows: WarehouseEntryRow[]) {
    const uniqueSkillIds = [
      ...new Set(rows.map((item) => item.skill_id).filter((item): item is string => Boolean(item))),
    ];
    const skills = await Promise.all(
      uniqueSkillIds.map(async (skillId) => {
        const detail = await this.skillsService.queryDetailByUser(userId, skillId);
        return detail ? ([skillId, detail] as const) : null;
      }),
    );

    return new Map(
      skills.filter(
        (item): item is readonly [string, SkillDetailResponse] => Boolean(item),
      ),
    );
  }

  private buildEntryResponse(
    row: WarehouseEntryRow,
    itemMap: Map<string, Awaited<ReturnType<ItemsService['queryListByUser']>>[number]>,
    skillMap: Map<string, SkillDetailResponse>,
  ) {
    const quantity = clampWarehouseQuantity(Number(row.quantity ?? 1));
    const entryAffixes = this.parseAffixConfig(row.affix_config);

    if (row.entry_type === 'skill_card') {
      const skill = row.skill_id ? skillMap.get(row.skill_id) ?? null : null;
      return {
        uuid: row.uuid,
        entryType: 'skill_card',
        quantity,
        isEquipped: false,
        equippedSlot: '',
        remainingUses: null,
        durabilityCurrent: null,
        durabilityMax: null,
        breakRisk: null,
        entryAffixes: [],
        skill,
        item: null,
        displayName: skill ? `${skill.name}技能卡` : '未知技能卡',
        description: skill?.description ?? '',
        createTime: Number(row.createTime ?? 0),
        updateTime: Number(row.updateTime ?? 0),
      };
    }

    const item = row.item_id ? itemMap.get(row.item_id) ?? null : null;
    const weaponConfig = item?.weaponConfig ?? null;
    const durabilityMax =
      weaponConfig !== null
        ? Math.max(weaponConfig.minDurability, Number(row.durability_max ?? weaponConfig.maxDurability))
        : null;
    const durabilityCurrent =
      weaponConfig !== null && durabilityMax !== null
        ? Math.min(
            durabilityMax,
            Math.max(weaponConfig.minDurability, Number(row.durability_current ?? durabilityMax)),
          )
        : null;

    return {
      uuid: row.uuid,
      entryType: 'item',
      quantity,
      isEquipped: !!row.is_equipped,
      equippedSlot: row.equipped_slot ?? '',
      remainingUses:
        item?.consumableConfig !== null && item?.consumableConfig !== undefined
          ? Math.max(0, Number(row.remaining_uses ?? item.consumableConfig.maxUses))
          : null,
      durabilityCurrent,
      durabilityMax,
      breakRisk:
        weaponConfig !== null && durabilityCurrent !== null && durabilityMax !== null
          ? computeWeaponBreakRisk(durabilityCurrent, durabilityMax, weaponConfig.breakRiskScale)
          : null,
      entryAffixes,
      skill: null,
      item,
      displayName: item?.name ?? '未知物品',
      description: item?.description ?? '',
      createTime: Number(row.createTime ?? 0),
      updateTime: Number(row.updateTime ?? 0),
    };
  }

  private parseAffixConfig(raw?: string | unknown) {
    if (!raw) {
      return [] as ItemAffix[];
    }

    try {
      const parsed = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
      if (!Array.isArray(parsed)) {
        return [] as ItemAffix[];
      }

      return parsed
        .map((item) => item as ItemAffix)
        .filter((item) => Array.isArray(item.modifiers));
    } catch {
      return [] as ItemAffix[];
    }
  }

  private queryEntries(warehouseId: string) {
    return this.db.query<WarehouseEntryRow>(
      'select * from user_warehouse_entry_table where warehouse_id = ? order by createTime asc',
      [warehouseId],
    );
  }

  private findWarehouseRowByUserId(userId: string) {
    return this.db.findFirst<WarehouseRecord>('select * from user_warehouse_table where user_id = ?', [
      userId,
    ]);
  }
}
