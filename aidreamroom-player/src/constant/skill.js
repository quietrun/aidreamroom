import { roleAbilityDefinitions, roleAttributeDefinitions } from './userRole';

const attributeLabelMap = new Map(roleAttributeDefinitions.map((item) => [item.key, item.label]));
const abilityLabelMap = new Map(roleAbilityDefinitions.map((item) => [item.key, item.label]));

function formatNumber(value) {
  const normalized = Number(value ?? 0);
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }

  return normalized.toFixed(2).replace(/\.?0+$/, '');
}

export function getSkillAbilityLabel(key, fallback = '') {
  return abilityLabelMap.get(key) || fallback || key;
}

export function getSkillAttributeLabel(key, fallback = '') {
  return attributeLabelMap.get(key) || fallback || key;
}

export function formatSkillFormula(skill) {
  if (skill?.formulaLabel) {
    return skill.formulaLabel;
  }

  const terms = Array.isArray(skill?.formulaConfig?.terms) ? skill.formulaConfig.terms : [];
  if (!terms.length) {
    return '暂无伤害公式';
  }

  return terms
    .map((term) => {
      if (term.type === 'constant') {
        return formatNumber(term.value);
      }

      if (term.type === 'attribute') {
        return `${getSkillAttributeLabel(term.key)}×${formatNumber(term.scale)}`;
      }

      if (term.type === 'ability') {
        return `${getSkillAbilityLabel(term.key)}等级×${formatNumber(term.scale)}`;
      }

      return null;
    })
    .filter(Boolean)
    .join(' + ');
}

export function summarizeSkillList(list = []) {
  const total = list.length;
  const availableCount = list.filter((item) => item.available).length;
  const highestDamageSkill = list.reduce((current, item) => {
    if (!current) {
      return item;
    }

    return Number(item.damagePreview ?? -Infinity) > Number(current.damagePreview ?? -Infinity) ? item : current;
  }, null);

  return {
    total,
    availableCount,
    unavailableCount: Math.max(0, total - availableCount),
    highestDamageSkill,
  };
}
