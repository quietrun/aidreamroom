import { roleAbilityDefinitions, roleAttributeDefinitions } from './userRole';

const attributeLabelMap = new Map(roleAttributeDefinitions.map((item) => [item.key, item.label]));
const abilityLabelMap = new Map(roleAbilityDefinitions.map((item) => [item.key, item.label]));

export const itemTypeDefinitions = [
  { key: 'consumable', label: '消耗品' },
  { key: 'weapon', label: '武器' },
  { key: 'equipment', label: '装备' },
];

export const equipmentSlotDefinitions = [
  { key: 'hat', label: '帽子' },
  { key: 'clothes', label: '衣服' },
  { key: 'pants', label: '裤子' },
  { key: 'shoes', label: '鞋子' },
  { key: 'gloves', label: '手套' },
  { key: 'accessory', label: '饰品' },
];

export const derivedStatDefinitions = [
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
];

const typeLabelMap = new Map(itemTypeDefinitions.map((item) => [item.key, item.label]));
const slotLabelMap = new Map(equipmentSlotDefinitions.map((item) => [item.key, item.label]));
const derivedLabelMap = new Map(derivedStatDefinitions.map((item) => [item.key, item.label]));

function formatNumber(value) {
  const normalized = Number(value ?? 0);
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }

  return normalized.toFixed(2).replace(/\.?0+$/, '');
}

function formatSigned(value) {
  const normalized = Number(value ?? 0);
  return `${normalized >= 0 ? '+' : ''}${formatNumber(normalized)}`;
}

export function getItemTypeLabel(key) {
  return typeLabelMap.get(key) || key || '--';
}

export function getEquipmentSlotLabel(key) {
  return slotLabelMap.get(key) || key || '--';
}

export function getDerivedLabel(key) {
  return derivedLabelMap.get(key) || key || '--';
}

export function formatModifierLabel(modifier) {
  if (!modifier) {
    return '--';
  }

  if (modifier.label) {
    return modifier.label;
  }

  if (modifier.targetType === 'attribute') {
    return `${attributeLabelMap.get(modifier.key) || modifier.key} ${formatSigned(modifier.value)}`;
  }

  if (modifier.targetType === 'ability') {
    return `${abilityLabelMap.get(modifier.key) || modifier.key}等级 ${formatSigned(modifier.value)}`;
  }

  return `${getDerivedLabel(modifier.key)} ${formatSigned(modifier.value)}`;
}

export function formatConsumableEffectLabel(effect) {
  if (!effect) {
    return '--';
  }

  const prefix = effect.effectKind === 'permanent' ? '永久' : '临时';
  return `${prefix}${formatModifierLabel(effect)}`;
}

export function formatItemFormula(item) {
  if (item?.formulaLabel) {
    return item.formulaLabel;
  }

  const terms = Array.isArray(item?.formulaConfig?.terms) ? item.formulaConfig.terms : [];
  if (!terms.length) {
    return '暂无伤害公式';
  }

  return terms
    .map((term) => {
      if (term.type === 'constant') {
        return formatNumber(term.value);
      }

      if (term.type === 'attribute') {
        return `${attributeLabelMap.get(term.key) || term.key}×${formatNumber(term.scale)}`;
      }

      if (term.type === 'ability') {
        return `${abilityLabelMap.get(term.key) || term.key}等级×${formatNumber(term.scale)}`;
      }

      return null;
    })
    .filter(Boolean)
    .join(' + ');
}

export function summarizeItemCatalog(list = []) {
  const consumables = list.filter((item) => item.itemType === 'consumable').length;
  const weapons = list.filter((item) => item.itemType === 'weapon').length;
  const equipments = list.filter((item) => item.itemType === 'equipment').length;
  const highestDamageWeapon = list
    .filter((item) => item.itemType === 'weapon')
    .reduce((current, item) => {
      if (!current) {
        return item;
      }

      return Number(item.damagePreview ?? -Infinity) > Number(current.damagePreview ?? -Infinity)
        ? item
        : current;
    }, null);

  return {
    total: list.length,
    consumables,
    weapons,
    equipments,
    highestDamageWeapon,
  };
}

export function summarizeWarehouse(profile) {
  const entries = Array.isArray(profile?.entries) ? profile.entries : [];
  const items = entries.filter((entry) => entry.entryType === 'item');
  const skillCards = entries.filter((entry) => entry.entryType === 'skill_card');

  return {
    usedSlots: Number(profile?.usedSlots ?? 0),
    freeSlots: Number(profile?.freeSlots ?? 0),
    capacity: Number(profile?.capacity ?? 0),
    consumables: items.filter((entry) => entry.item?.itemType === 'consumable').length,
    weapons: items.filter((entry) => entry.item?.itemType === 'weapon').length,
    equipments: items.filter((entry) => entry.item?.itemType === 'equipment').length,
    skillCards: skillCards.length,
    equippedCount: items.filter((entry) => entry.isEquipped).length,
  };
}
