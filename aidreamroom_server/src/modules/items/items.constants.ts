import {
  USER_ROLE_ABILITY_CONFIG,
  USER_ROLE_ATTRIBUTE_CONFIG,
  UserRoleAbilityKey,
  UserRoleAbilityState,
  UserRoleAttributeKey,
  UserRoleAttributes,
} from '../user-role/user-role.constants';
import {
  DEFAULT_SKILL_FORMULA_CONFIG,
  SkillFormulaConfig,
  evaluateSkillDamage,
  normalizeSkillFormulaConfig,
} from '../skills/skills.constants';

export const ITEM_TYPES = ['consumable', 'weapon', 'equipment'] as const;
export const ITEM_EQUIPMENT_SLOT_CONFIG = [
  { key: 'hat', label: '帽子' },
  { key: 'clothes', label: '衣服' },
  { key: 'pants', label: '裤子' },
  { key: 'shoes', label: '鞋子' },
  { key: 'gloves', label: '手套' },
  { key: 'accessory', label: '饰品' },
] as const;
export const ITEM_MODIFIER_TARGET_TYPES = ['attribute', 'ability', 'derived'] as const;
export const ITEM_EFFECT_KINDS = ['permanent', 'temporary'] as const;
export const DERIVED_STAT_CONFIG = [
  { key: 'maxHp', label: '生命上限' },
  { key: 'maxMp', label: '魔法上限' },
  { key: 'carryCapacity', label: '负重' },
  { key: 'pushLimit', label: '推举极限' },
  { key: 'moveRate', label: '移动速率' },
  { key: 'shootBonus', label: '射击加成' },
  { key: 'socialBonus', label: '社交加成' },
  { key: 'spellResistance', label: '精神抗性' },
  { key: 'learningBonus', label: '学习加成' },
  { key: 'critBonus', label: '幸运加成' },
] as const;

export type ItemType = (typeof ITEM_TYPES)[number];
export type ItemEquipmentSlot = (typeof ITEM_EQUIPMENT_SLOT_CONFIG)[number]['key'];
export type ItemModifierTargetType = (typeof ITEM_MODIFIER_TARGET_TYPES)[number];
export type ItemEffectKind = (typeof ITEM_EFFECT_KINDS)[number];
export type DerivedStatKey = (typeof DERIVED_STAT_CONFIG)[number]['key'];

export type ItemModifier =
  | {
      targetType: 'attribute';
      key: UserRoleAttributeKey;
      value: number;
      label: string;
    }
  | {
      targetType: 'ability';
      key: UserRoleAbilityKey;
      value: number;
      label: string;
    }
  | {
      targetType: 'derived';
      key: DerivedStatKey;
      value: number;
      label: string;
    };

export type ConsumableEffect = ItemModifier & {
  effectKind: ItemEffectKind;
};

export type ItemAffix = {
  name: string;
  modifiers: ItemModifier[];
};

export type ConsumableConfig = {
  maxUses: number;
  effects: ConsumableEffect[];
};

export type WeaponConfig = {
  maxDurability: number;
  durabilityCostPerUse: number;
  minDurability: number;
  breakRiskScale: number;
  bonusDamageLabel: string;
};

export type EquipmentConfig = {
  slot: ItemEquipmentSlot;
  modifiers: ItemModifier[];
  bonusAffixes: ItemAffix[];
};

export const DEFAULT_CONSUMABLE_CONFIG: ConsumableConfig = {
  maxUses: 1,
  effects: [],
};

export const DEFAULT_WEAPON_CONFIG: WeaponConfig = {
  maxDurability: 100,
  durabilityCostPerUse: 1,
  minDurability: 1,
  breakRiskScale: 40,
  bonusDamageLabel: '',
};

export const DEFAULT_EQUIPMENT_CONFIG: EquipmentConfig = {
  slot: 'accessory',
  modifiers: [],
  bonusAffixes: [],
};

export const DEFAULT_ITEM_DEFINITIONS: Array<{
  uuid: string;
  name: string;
  description: string;
  itemType: ItemType;
  itemSubType?: ItemEquipmentSlot;
  effectLabel: string;
  effectConfig: Record<string, unknown>;
  formulaLabel?: string;
  formulaConfig?: SkillFormulaConfig;
  stackLimit: number;
}> = [];

const attributeKeySet = new Set<UserRoleAttributeKey>(USER_ROLE_ATTRIBUTE_CONFIG.map((item) => item.key));
const abilityKeySet = new Set<UserRoleAbilityKey>(USER_ROLE_ABILITY_CONFIG.map((item) => item.key));
const derivedKeySet = new Set<DerivedStatKey>(DERIVED_STAT_CONFIG.map((item) => item.key));
const equipmentSlotSet = new Set<ItemEquipmentSlot>(ITEM_EQUIPMENT_SLOT_CONFIG.map((item) => item.key));

function clampNumber(value: number, min: number, max: number, fallback: number) {
  const normalized = Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, normalized));
}

function normalizeModifierTargetType(raw: unknown): ItemModifierTargetType | null {
  if (raw === 'attribute' || raw === 'ability' || raw === 'derived') {
    return raw;
  }

  return null;
}

function buildDefaultModifierLabel(targetType: ItemModifierTargetType, key: string, value: number) {
  const sign = value >= 0 ? '+' : '';
  if (targetType === 'attribute') {
    const label = USER_ROLE_ATTRIBUTE_CONFIG.find((item) => item.key === key)?.label ?? key;
    return `${label} ${sign}${value}`;
  }

  if (targetType === 'ability') {
    const label = USER_ROLE_ABILITY_CONFIG.find((item) => item.key === key)?.label ?? key;
    return `${label}等级 ${sign}${value}`;
  }

  const label = DERIVED_STAT_CONFIG.find((item) => item.key === key)?.label ?? key;
  return `${label} ${sign}${value}`;
}

function normalizeItemModifier(raw: Record<string, unknown>): ItemModifier | null {
  const targetType = normalizeModifierTargetType(raw.targetType);
  if (!targetType) {
    return null;
  }

  const value = Math.round(clampNumber(Number(raw.value ?? 0), -999, 999, 0));
  const label = String(raw.label ?? '').trim();

  if (targetType === 'attribute' && typeof raw.key === 'string' && attributeKeySet.has(raw.key as UserRoleAttributeKey)) {
    return {
      targetType,
      key: raw.key as UserRoleAttributeKey,
      value,
      label: label || buildDefaultModifierLabel(targetType, raw.key, value),
    };
  }

  if (targetType === 'ability' && typeof raw.key === 'string' && abilityKeySet.has(raw.key as UserRoleAbilityKey)) {
    return {
      targetType,
      key: raw.key as UserRoleAbilityKey,
      value,
      label: label || buildDefaultModifierLabel(targetType, raw.key, value),
    };
  }

  if (targetType === 'derived' && typeof raw.key === 'string' && derivedKeySet.has(raw.key as DerivedStatKey)) {
    return {
      targetType,
      key: raw.key as DerivedStatKey,
      value,
      label: label || buildDefaultModifierLabel(targetType, raw.key, value),
    };
  }

  return null;
}

function normalizeConsumableEffect(raw: Record<string, unknown>): ConsumableEffect | null {
  const modifier = normalizeItemModifier(raw);
  if (!modifier) {
    return null;
  }

  const effectKind = raw.effectKind === 'permanent' ? 'permanent' : 'temporary';
  return {
    ...modifier,
    effectKind,
  };
}

function normalizeItemAffix(raw: Record<string, unknown>): ItemAffix | null {
  const name = String(raw.name ?? '').trim();
  const modifiers = Array.isArray(raw.modifiers)
    ? raw.modifiers
        .map((item) => normalizeItemModifier((item ?? {}) as Record<string, unknown>))
        .filter((item): item is ItemModifier => Boolean(item))
    : [];

  if (!name && !modifiers.length) {
    return null;
  }

  return {
    name: name || '额外词条',
    modifiers,
  };
}

export function normalizeConsumableConfig(raw?: Record<string, unknown> | null): ConsumableConfig {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_CONSUMABLE_CONFIG;
  }

  const effects = Array.isArray(raw.effects)
    ? raw.effects
        .map((item) => normalizeConsumableEffect((item ?? {}) as Record<string, unknown>))
        .filter((item): item is ConsumableEffect => Boolean(item))
    : [];

  return {
    maxUses: Math.round(clampNumber(Number(raw.maxUses ?? 1), 1, 99, 1)),
    effects,
  };
}

export function normalizeWeaponConfig(raw?: Record<string, unknown> | null): WeaponConfig {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_WEAPON_CONFIG;
  }

  const maxDurability = Math.round(clampNumber(Number(raw.maxDurability ?? 100), 1, 9999, 100));
  const minDurability = Math.round(clampNumber(Number(raw.minDurability ?? 1), 1, maxDurability, 1));
  return {
    maxDurability,
    durabilityCostPerUse: Math.round(clampNumber(Number(raw.durabilityCostPerUse ?? 1), 1, 999, 1)),
    minDurability,
    breakRiskScale: Math.round(clampNumber(Number(raw.breakRiskScale ?? 40), 1, 95, 40)),
    bonusDamageLabel: String(raw.bonusDamageLabel ?? '').trim(),
  };
}

export function normalizeEquipmentConfig(
  raw?: Record<string, unknown> | null,
  itemSubType?: string | null,
): EquipmentConfig {
  const fallbackSlot =
    typeof itemSubType === 'string' && equipmentSlotSet.has(itemSubType as ItemEquipmentSlot)
      ? (itemSubType as ItemEquipmentSlot)
      : DEFAULT_EQUIPMENT_CONFIG.slot;

  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_EQUIPMENT_CONFIG,
      slot: fallbackSlot,
    };
  }

  const slot =
    typeof raw.slot === 'string' && equipmentSlotSet.has(raw.slot as ItemEquipmentSlot)
      ? (raw.slot as ItemEquipmentSlot)
      : fallbackSlot;

  const modifiers = Array.isArray(raw.modifiers)
    ? raw.modifiers
        .map((item) => normalizeItemModifier((item ?? {}) as Record<string, unknown>))
        .filter((item): item is ItemModifier => Boolean(item))
    : [];

  const bonusAffixes = Array.isArray(raw.bonusAffixes)
    ? raw.bonusAffixes
        .map((item) => normalizeItemAffix((item ?? {}) as Record<string, unknown>))
        .filter((item): item is ItemAffix => Boolean(item))
    : [];

  return {
    slot,
    modifiers,
    bonusAffixes,
  };
}

export function normalizeItemSubType(itemType: ItemType, itemSubType?: string | null) {
  if (itemType !== 'equipment') {
    return '';
  }

  if (typeof itemSubType === 'string' && equipmentSlotSet.has(itemSubType as ItemEquipmentSlot)) {
    return itemSubType as ItemEquipmentSlot;
  }

  return DEFAULT_EQUIPMENT_CONFIG.slot;
}

export function normalizeItemType(raw: string): ItemType {
  if (raw === 'consumable' || raw === 'weapon' || raw === 'equipment') {
    return raw;
  }

  return 'consumable';
}

export function evaluateItemWeaponDamage(
  formulaConfig: SkillFormulaConfig,
  attributes: UserRoleAttributes,
  abilities: UserRoleAbilityState[],
) {
  return evaluateSkillDamage(formulaConfig, attributes, abilities);
}

export function clampItemStackLimit(value: number) {
  return Math.round(clampNumber(Number(value ?? 1), 1, 999, 1));
}

export function clampDurabilityValue(value: number, maxDurability: number, minDurability = 1) {
  return Math.round(
    clampNumber(Number(value ?? maxDurability), minDurability, maxDurability, maxDurability),
  );
}

export function computeWeaponBreakRisk(
  currentDurability: number,
  maxDurability: number,
  breakRiskScale: number,
) {
  const safeMax = Math.max(1, maxDurability);
  const ratio = clampNumber(currentDurability / safeMax, 0, 1, 1);
  return Math.round(clampNumber((1 - ratio) * breakRiskScale + 2, 1, 95, 1));
}

export function normalizeWeaponFormulaConfig(raw?: Record<string, unknown> | null) {
  return normalizeSkillFormulaConfig(raw ?? DEFAULT_SKILL_FORMULA_CONFIG);
}
