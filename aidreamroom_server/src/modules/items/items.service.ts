import { Injectable } from '@nestjs/common';

import { LegacyDbService } from '../../common/database/legacy-db.service';
import { generateUuid } from '../../common/utils/id.util';
import { normalizeTimestamp } from '../../common/utils/number.util';
import { SkillFormulaConfig, normalizeSkillFormulaConfig } from '../skills/skills.constants';
import { UserRoleService } from '../user-role/user-role.service';
import {
  ConsumableConfig,
  DEFAULT_ITEM_DEFINITIONS,
  EquipmentConfig,
  ItemType,
  WeaponConfig,
  clampItemStackLimit,
  evaluateItemWeaponDamage,
  normalizeConsumableConfig,
  normalizeEquipmentConfig,
  normalizeItemSubType,
  normalizeItemType,
  normalizeWeaponConfig,
} from './items.constants';

type ItemRecord = {
  uuid: string;
  name: string;
  description: string | null;
  item_type: string;
  item_sub_type: string | null;
  effect_label: string | null;
  effect_config: string | null;
  formula_label: string | null;
  formula_config: string | null;
  stack_limit: number | null;
  is_active: boolean | null;
  createTime: number | null;
  updateTime: number | null;
};

type SaveItemPayload = {
  name: string;
  description?: string;
  itemType: string;
  itemSubType?: string;
  effectLabel?: string;
  effectConfig?: unknown;
  formulaLabel?: string;
  formulaConfig?: unknown;
  stackLimit?: number;
  isActive?: boolean;
};

@Injectable()
export class ItemsService {
  constructor(
    private readonly db: LegacyDbService,
    private readonly userRoleService: UserRoleService,
  ) {}

  async queryListByUser(userId: string) {
    await this.ensureCatalog();

    const [rows, role] = await Promise.all([
      this.db.query<ItemRecord>(
        'select * from item_table where is_active = ? order by item_type asc, updateTime desc, createTime desc',
        [true],
      ),
      this.userRoleService.queryProfile(userId),
    ]);

    return rows.map((row) => this.buildItemResponse(row, role));
  }

  async queryDetailByUser(userId: string, itemId: string) {
    await this.ensureCatalog();

    const [row, role] = await Promise.all([
      this.findItemRowById(itemId),
      this.userRoleService.queryProfile(userId),
    ]);

    if (!row) {
      return null;
    }

    return this.buildItemResponse(row, role);
  }

  async create(payload: SaveItemPayload) {
    await this.ensureCatalog();
    return this.saveItem(payload, null);
  }

  async update(itemId: string, payload: SaveItemPayload) {
    await this.ensureCatalog();
    const current = await this.findItemRowById(itemId);
    if (!current) {
      return null;
    }

    return this.saveItem(payload, current);
  }

  async ensureCatalog() {
    const existing = await this.db.findFirst<{ uuid: string }>('select uuid from item_table limit 1');
    if (existing) {
      return;
    }

    const now = normalizeTimestamp();
    for (const item of DEFAULT_ITEM_DEFINITIONS) {
      await this.db.replaceInto('item_table', {
        uuid: item.uuid,
        name: item.name,
        description: item.description,
        item_type: item.itemType,
        item_sub_type: item.itemSubType ?? '',
        effect_label: item.effectLabel,
        effect_config: JSON.stringify(item.effectConfig),
        formula_label: item.formulaLabel ?? '',
        formula_config: item.formulaConfig ? JSON.stringify(item.formulaConfig) : null,
        stack_limit: item.stackLimit,
        is_active: true,
        createTime: now,
        updateTime: now,
      });
    }
  }

  private async saveItem(payload: SaveItemPayload, current: ItemRecord | null) {
    const now = normalizeTimestamp();
    const itemId = current?.uuid ?? generateUuid();
    const itemType = normalizeItemType(payload.itemType);
    const itemSubType = normalizeItemSubType(itemType, payload.itemSubType ?? current?.item_sub_type);
    const normalizedEffectConfig = this.normalizeEffectConfig(
      itemType,
      (payload.effectConfig ?? this.parseJson(current?.effect_config)) as Record<string, unknown> | null,
      itemSubType,
    );
    const formulaConfig =
      itemType === 'weapon'
        ? normalizeSkillFormulaConfig(
            (payload.formulaConfig ?? this.parseJson(current?.formula_config)) as Record<
              string,
              unknown
            > | null,
          )
        : null;

    await this.db.replaceInto('item_table', {
      uuid: itemId,
      name: payload.name.trim(),
      description: payload.description?.trim() || '',
      item_type: itemType,
      item_sub_type: itemSubType,
      effect_label: payload.effectLabel?.trim() || current?.effect_label || '',
      effect_config: JSON.stringify(normalizedEffectConfig),
      formula_label:
        itemType === 'weapon' ? payload.formulaLabel?.trim() || current?.formula_label || '' : '',
      formula_config: formulaConfig ? JSON.stringify(formulaConfig) : null,
      stack_limit: clampItemStackLimit(payload.stackLimit ?? Number(current?.stack_limit ?? 1)),
      is_active: payload.isActive ?? current?.is_active ?? true,
      createTime: current?.createTime ?? now,
      updateTime: now,
    });

    const latest = await this.findItemRowById(itemId);
    if (!latest) {
      return null;
    }

    return this.buildItemResponse(latest, null);
  }

  private buildItemResponse(
    row: ItemRecord,
    role: Awaited<ReturnType<UserRoleService['queryProfile']>>,
  ) {
    const itemType = normalizeItemType(row.item_type);
    const itemSubType = normalizeItemSubType(itemType, row.item_sub_type);
    const effectRaw = this.parseJson(row.effect_config);
    const consumableConfig = itemType === 'consumable' ? normalizeConsumableConfig(effectRaw) : null;
    const weaponConfig = itemType === 'weapon' ? normalizeWeaponConfig(effectRaw) : null;
    const equipmentConfig =
      itemType === 'equipment' ? normalizeEquipmentConfig(effectRaw, itemSubType) : null;
    const formulaConfig = itemType === 'weapon' ? this.parseFormulaConfig(row.formula_config) : null;
    const damagePreview =
      role && formulaConfig ? evaluateItemWeaponDamage(formulaConfig, role.attributes, role.abilities) : null;

    return {
      uuid: row.uuid,
      name: row.name,
      description: row.description ?? '',
      itemType,
      itemSubType,
      effectLabel: row.effect_label ?? '',
      formulaLabel: row.formula_label ?? '',
      formulaConfig,
      consumableConfig,
      weaponConfig,
      equipmentConfig,
      stackLimit: clampItemStackLimit(Number(row.stack_limit ?? 1)),
      damagePreview,
      createTime: Number(row.createTime ?? 0),
      updateTime: Number(row.updateTime ?? 0),
    };
  }

  private normalizeEffectConfig(
    itemType: ItemType,
    raw: Record<string, unknown> | null,
    itemSubType: string,
  ): ConsumableConfig | WeaponConfig | EquipmentConfig {
    if (itemType === 'weapon') {
      return normalizeWeaponConfig(raw);
    }

    if (itemType === 'equipment') {
      return normalizeEquipmentConfig(raw, itemSubType);
    }

    return normalizeConsumableConfig(raw);
  }

  private parseFormulaConfig(raw: string | null): SkillFormulaConfig {
    if (!raw) {
      return normalizeSkillFormulaConfig(null);
    }

    try {
      return normalizeSkillFormulaConfig(JSON.parse(raw) as Record<string, unknown>);
    } catch {
      return normalizeSkillFormulaConfig(null);
    }
  }

  private parseJson(raw?: string | null) {
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private findItemRowById(itemId: string) {
    return this.db.findFirst<ItemRecord>('select * from item_table where uuid = ?', [itemId]);
  }
}
