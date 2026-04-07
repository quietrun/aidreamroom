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
}> = [
  {
    uuid: 'item_giant_blood_tonic',
    name: '巨血营养剂',
    description: '浓缩型体能药剂，能稳定提升肌体极限，同时提供一次性生命恢复收益。',
    itemType: 'consumable',
    effectLabel: '永久力量 +2，生命上限 +6',
    effectConfig: {
      maxUses: 1,
      effects: [
        {
          effectKind: 'permanent',
          targetType: 'attribute',
          key: 'strength',
          value: 2,
          label: '永久力量 +2',
        },
        {
          effectKind: 'temporary',
          targetType: 'derived',
          key: 'maxHp',
          value: 6,
          label: '生命上限 +6',
        },
      ],
    },
    stackLimit: 10,
  },
  {
    uuid: 'item_starlight_inhaler',
    name: '星辉吸入剂',
    description: '短时间提升精神专注，适合探索与施法前使用。',
    itemType: 'consumable',
    effectLabel: '魔法上限 +8，幸运加成 +1',
    effectConfig: {
      maxUses: 3,
      effects: [
        {
          effectKind: 'temporary',
          targetType: 'derived',
          key: 'maxMp',
          value: 8,
          label: '魔法上限 +8',
        },
        {
          effectKind: 'temporary',
          targetType: 'derived',
          key: 'critBonus',
          value: 1,
          label: '幸运加成 +1',
        },
      ],
    },
    stackLimit: 6,
  },
  {
    uuid: 'item_hunter_rifle',
    name: '猎手步枪',
    description: '中远距离压制武器，射手能力越高，附加伤害越稳定。',
    itemType: 'weapon',
    effectLabel: '穿甲附伤，命中后对轻甲目标更有效',
    effectConfig: {
      maxDurability: 120,
      durabilityCostPerUse: 6,
      minDurability: 1,
      breakRiskScale: 42,
      bonusDamageLabel: '穿甲附伤',
    },
    formulaLabel: '14 + 敏捷×0.28 + 射击等级×11',
    formulaConfig: {
      roundMode: 'round',
      min: 0,
      max: null,
      terms: [
        { type: 'constant', value: 14 },
        { type: 'attribute', key: 'dexterity', scale: 0.28 },
        { type: 'ability', key: 'shooting', scale: 11 },
      ],
    },
    stackLimit: 1,
  },
  {
    uuid: 'item_crushing_axe',
    name: '碎骨战斧',
    description: '偏重型近战武器，依赖力量与格斗能力发挥破坏力。',
    itemType: 'weapon',
    effectLabel: '撕裂附伤，近战破坏力极高',
    effectConfig: {
      maxDurability: 140,
      durabilityCostPerUse: 8,
      minDurability: 1,
      breakRiskScale: 46,
      bonusDamageLabel: '撕裂附伤',
    },
    formulaLabel: '10 + 力量×0.32 + 体型×0.1 + 格斗等级×12',
    formulaConfig: {
      roundMode: 'round',
      min: 0,
      max: null,
      terms: [
        { type: 'constant', value: 10 },
        { type: 'attribute', key: 'strength', scale: 0.32 },
        { type: 'attribute', key: 'size', scale: 0.1 },
        { type: 'ability', key: 'fighting', scale: 12 },
      ],
    },
    stackLimit: 1,
  },
  {
    uuid: 'item_night_watch_hat',
    name: '夜巡宽檐帽',
    description: '巡夜者偏爱的帽饰，能修饰仪表并强化观察意识。',
    itemType: 'equipment',
    itemSubType: 'hat',
    effectLabel: '外貌 +6，侦查 +1',
    effectConfig: {
      slot: 'hat',
      modifiers: [
        {
          targetType: 'attribute',
          key: 'appearance',
          value: 6,
          label: '外貌 +6',
        },
        {
          targetType: 'ability',
          key: 'investigation',
          value: 1,
          label: '侦查等级 +1',
        },
      ],
      bonusAffixes: [
        {
          name: '夜行观察',
          modifiers: [
            {
              targetType: 'derived',
              key: 'moveRate',
              value: 1,
              label: '移动速率 +1',
            },
          ],
        },
      ],
    },
    stackLimit: 1,
  },
  {
    uuid: 'item_field_coat',
    name: '远征风衣',
    description: '耐久型外套，适合长期探索与连续遭遇战。',
    itemType: 'equipment',
    itemSubType: 'clothes',
    effectLabel: '体质 +5，生命上限 +8',
    effectConfig: {
      slot: 'clothes',
      modifiers: [
        {
          targetType: 'attribute',
          key: 'constitution',
          value: 5,
          label: '体质 +5',
        },
        {
          targetType: 'derived',
          key: 'maxHp',
          value: 8,
          label: '生命上限 +8',
        },
      ],
      bonusAffixes: [
        {
          name: '应急口袋',
          modifiers: [
            {
              targetType: 'ability',
              key: 'general',
              value: 1,
              label: '通用等级 +1',
            },
          ],
        },
      ],
    },
    stackLimit: 1,
  },
  {
    uuid: 'item_phase_boots',
    name: '相位行军靴',
    description: '轻量化战术靴，强化位移速度和下盘稳定性。',
    itemType: 'equipment',
    itemSubType: 'shoes',
    effectLabel: '敏捷 +5，移动速率 +1',
    effectConfig: {
      slot: 'shoes',
      modifiers: [
        {
          targetType: 'attribute',
          key: 'dexterity',
          value: 5,
          label: '敏捷 +5',
        },
        {
          targetType: 'derived',
          key: 'moveRate',
          value: 1,
          label: '移动速率 +1',
        },
      ],
      bonusAffixes: [
        {
          name: '静音步态',
          modifiers: [
            {
              targetType: 'ability',
              key: 'investigation',
              value: 1,
              label: '侦查等级 +1',
            },
          ],
        },
      ],
    },
    stackLimit: 1,
  },
  {
    uuid: 'item_mechanic_gloves',
    name: '精修手套',
    description: '器械维护专用手套，能让细小操作更稳定。',
    itemType: 'equipment',
    itemSubType: 'gloves',
    effectLabel: '敏捷 +3，器械 +1',
    effectConfig: {
      slot: 'gloves',
      modifiers: [
        {
          targetType: 'attribute',
          key: 'dexterity',
          value: 3,
          label: '敏捷 +3',
        },
        {
          targetType: 'ability',
          key: 'machinery',
          value: 1,
          label: '器械等级 +1',
        },
      ],
      bonusAffixes: [
        {
          name: '精密触感',
          modifiers: [
            {
              targetType: 'derived',
              key: 'learningBonus',
              value: 1,
              label: '学习加成 +1',
            },
          ],
        },
      ],
    },
    stackLimit: 1,
  },
  {
    uuid: 'item_elder_amulet',
    name: '旧神护符',
    description: '具备灵性回响的饰品，可用于提升召唤与法术对抗能力。',
    itemType: 'equipment',
    itemSubType: 'accessory',
    effectLabel: '意志 +4，精神抗性 +2',
    effectConfig: {
      slot: 'accessory',
      modifiers: [
        {
          targetType: 'attribute',
          key: 'power',
          value: 4,
          label: '意志 +4',
        },
        {
          targetType: 'derived',
          key: 'spellResistance',
          value: 2,
          label: '精神抗性 +2',
        },
      ],
      bonusAffixes: [
        {
          name: '异界回声',
          modifiers: [
            {
              targetType: 'ability',
              key: 'magic',
              value: 1,
              label: '魔法等级 +1',
            },
          ],
        },
      ],
    },
    stackLimit: 1,
  },
];

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
