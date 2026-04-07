import {
  USER_ROLE_ABILITY_CONFIG,
  USER_ROLE_ATTRIBUTE_CONFIG,
  UserRoleAbilityKey,
  UserRoleAbilityState,
  UserRoleAttributeKey,
  UserRoleAttributes,
} from '../user-role/user-role.constants';

export const SKILL_FORMULA_TERM_TYPES = ['constant', 'attribute', 'ability'] as const;
export const SKILL_FORMULA_ROUND_MODES = ['round', 'floor', 'ceil'] as const;

export type SkillFormulaTermType = (typeof SKILL_FORMULA_TERM_TYPES)[number];
export type SkillFormulaRoundMode = (typeof SKILL_FORMULA_ROUND_MODES)[number];

export type SkillRequirement = {
  abilityKey: UserRoleAbilityKey;
  abilityName: string;
  requiredLevel: number;
};

export type SkillFormulaTerm =
  | {
      type: 'constant';
      value: number;
    }
  | {
      type: 'attribute';
      key: UserRoleAttributeKey;
      scale: number;
    }
  | {
      type: 'ability';
      key: UserRoleAbilityKey;
      scale: number;
    };

export type SkillFormulaConfig = {
  roundMode: SkillFormulaRoundMode;
  min: number | null;
  max: number | null;
  terms: SkillFormulaTerm[];
};

export type SkillAvailability = {
  met: boolean;
  currentLevel: number;
  missingLevel: number;
};

export const DEFAULT_SKILL_FORMULA_CONFIG: SkillFormulaConfig = {
  roundMode: 'round',
  min: 0,
  max: null,
  terms: [{ type: 'constant', value: 0 }],
};

export const DEFAULT_SKILL_DEFINITIONS: Array<{
  uuid: string;
  name: string;
  description: string;
  formulaLabel: string;
  formulaConfig: SkillFormulaConfig;
  requirements: Array<{
    abilityKey: UserRoleAbilityKey;
    requiredLevel: number;
  }>;
}> = [
  {
    uuid: 'skill_bone_breaker',
    name: '裂骨重击',
    description: '以体格与格斗强度发动的近战重击，适合高力量角色作为爆发手段。',
    formulaLabel: '8 + 力量×0.35 + 体型×0.15 + 格斗等级×12',
    formulaConfig: {
      roundMode: 'round',
      min: 0,
      max: null,
      terms: [
        { type: 'constant', value: 8 },
        { type: 'attribute', key: 'strength', scale: 0.35 },
        { type: 'attribute', key: 'size', scale: 0.15 },
        { type: 'ability', key: 'fighting', scale: 12 },
      ],
    },
    requirements: [
      { abilityKey: 'fighting', requiredLevel: 2 },
      { abilityKey: 'general', requiredLevel: 1 },
    ],
  },
  {
    uuid: 'skill_hunt_burst',
    name: '追猎点射',
    description: '依靠敏捷与射击熟练度锁定目标并完成多段压制，适合远程战斗。',
    formulaLabel: '10 + 敏捷×0.3 + 智力×0.1 + 射击等级×13',
    formulaConfig: {
      roundMode: 'round',
      min: 0,
      max: null,
      terms: [
        { type: 'constant', value: 10 },
        { type: 'attribute', key: 'dexterity', scale: 0.3 },
        { type: 'attribute', key: 'intelligence', scale: 0.1 },
        { type: 'ability', key: 'shooting', scale: 13 },
      ],
    },
    requirements: [
      { abilityKey: 'shooting', requiredLevel: 2 },
      { abilityKey: 'investigation', requiredLevel: 1 },
    ],
  },
  {
    uuid: 'skill_contract_call',
    name: '契印召唤',
    description: '依靠意志与召唤经验形成稳定契约，对异界存在造成持续压制。',
    formulaLabel: '12 + 意志×0.4 + 教育×0.08 + 召唤等级×15',
    formulaConfig: {
      roundMode: 'round',
      min: 0,
      max: null,
      terms: [
        { type: 'constant', value: 12 },
        { type: 'attribute', key: 'power', scale: 0.4 },
        { type: 'attribute', key: 'education', scale: 0.08 },
        { type: 'ability', key: 'summoning', scale: 15 },
      ],
    },
    requirements: [
      { abilityKey: 'summoning', requiredLevel: 3 },
      { abilityKey: 'magic', requiredLevel: 1 },
    ],
  },
  {
    uuid: 'skill_ether_burn',
    name: '以太灼烧',
    description: '将智力与意志转化为法术灼烧，对目标造成高稳定性的灵能伤害。',
    formulaLabel: '9 + 智力×0.22 + 意志×0.2 + 魔法等级×16',
    formulaConfig: {
      roundMode: 'round',
      min: 0,
      max: null,
      terms: [
        { type: 'constant', value: 9 },
        { type: 'attribute', key: 'intelligence', scale: 0.22 },
        { type: 'attribute', key: 'power', scale: 0.2 },
        { type: 'ability', key: 'magic', scale: 16 },
      ],
    },
    requirements: [
      { abilityKey: 'magic', requiredLevel: 2 },
      { abilityKey: 'general', requiredLevel: 1 },
    ],
  },
];

const attributeKeySet = new Set(USER_ROLE_ATTRIBUTE_CONFIG.map((item) => item.key));
const abilityKeySet = new Set(USER_ROLE_ABILITY_CONFIG.map((item) => item.key));
const abilityLabelMap = new Map(USER_ROLE_ABILITY_CONFIG.map((item) => [item.key, item.label]));

function clampNumber(value: number, min: number, max: number, fallback: number) {
  const normalized = Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, normalized));
}

function normalizeRoundMode(value?: string | null): SkillFormulaRoundMode {
  if (value === 'floor' || value === 'ceil') {
    return value;
  }

  return 'round';
}

function normalizeFormulaTerm(raw: Record<string, unknown>): SkillFormulaTerm | null {
  if (raw.type === 'constant') {
    return {
      type: 'constant',
      value: clampNumber(Number(raw.value ?? 0), -999999, 999999, 0),
    };
  }

  if (raw.type === 'attribute' && typeof raw.key === 'string' && attributeKeySet.has(raw.key as UserRoleAttributeKey)) {
    return {
      type: 'attribute',
      key: raw.key as UserRoleAttributeKey,
      scale: clampNumber(Number(raw.scale ?? 1), -1000, 1000, 1),
    };
  }

  if (raw.type === 'ability' && typeof raw.key === 'string' && abilityKeySet.has(raw.key as UserRoleAbilityKey)) {
    return {
      type: 'ability',
      key: raw.key as UserRoleAbilityKey,
      scale: clampNumber(Number(raw.scale ?? 1), -1000, 1000, 1),
    };
  }

  return null;
}

export function normalizeSkillFormulaConfig(raw?: Record<string, unknown> | null): SkillFormulaConfig {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_SKILL_FORMULA_CONFIG;
  }

  const terms = Array.isArray(raw.terms)
    ? raw.terms
        .map((item) => normalizeFormulaTerm((item ?? {}) as Record<string, unknown>))
        .filter((item): item is SkillFormulaTerm => Boolean(item))
    : [];

  return {
    roundMode: normalizeRoundMode(String(raw.roundMode ?? 'round')),
    min: raw.min === null || raw.min === undefined ? 0 : clampNumber(Number(raw.min), -999999, 999999, 0),
    max: raw.max === null || raw.max === undefined ? null : clampNumber(Number(raw.max), -999999, 999999, 999999),
    terms: terms.length ? terms : DEFAULT_SKILL_FORMULA_CONFIG.terms,
  };
}

export function normalizeSkillRequirements(
  input?: Array<{
    abilityKey: string;
    requiredLevel: number;
  }>,
): SkillRequirement[] {
  const uniqueMap = new Map<UserRoleAbilityKey, SkillRequirement>();

  for (const item of input ?? []) {
    const abilityKey = item.abilityKey as UserRoleAbilityKey;
    if (!abilityKeySet.has(abilityKey)) {
      continue;
    }

    uniqueMap.set(abilityKey, {
      abilityKey,
      abilityName: abilityLabelMap.get(abilityKey) ?? abilityKey,
      requiredLevel: Math.round(clampNumber(Number(item.requiredLevel ?? 0), 0, 10, 0)),
    });
  }

  return [...uniqueMap.values()].sort((left, right) => left.abilityKey.localeCompare(right.abilityKey));
}

export function evaluateSkillDamage(
  formulaConfig: SkillFormulaConfig,
  attributes: UserRoleAttributes,
  abilities: UserRoleAbilityState[],
) {
  const abilityLevelMap = new Map(abilities.map((item) => [item.abilityKey, Number(item.level ?? 0)]));
  const total = formulaConfig.terms.reduce((sum, term) => {
    if (term.type === 'constant') {
      return sum + Number(term.value ?? 0);
    }

    if (term.type === 'attribute') {
      return sum + Number(attributes[term.key] ?? 0) * Number(term.scale ?? 0);
    }

    return sum + Number(abilityLevelMap.get(term.key) ?? 0) * Number(term.scale ?? 0);
  }, 0);

  let next = total;
  if (formulaConfig.roundMode === 'floor') {
    next = Math.floor(next);
  } else if (formulaConfig.roundMode === 'ceil') {
    next = Math.ceil(next);
  } else {
    next = Math.round(next);
  }

  if (formulaConfig.min !== null) {
    next = Math.max(formulaConfig.min, next);
  }

  if (formulaConfig.max !== null) {
    next = Math.min(formulaConfig.max, next);
  }

  return next;
}

export function resolveSkillAvailability(
  requirement: SkillRequirement,
  abilities: UserRoleAbilityState[],
): SkillAvailability {
  const currentLevel = Number(
    abilities.find((item) => item.abilityKey === requirement.abilityKey)?.level ?? 0,
  );
  const missingLevel = Math.max(0, requirement.requiredLevel - currentLevel);

  return {
    met: missingLevel <= 0,
    currentLevel,
    missingLevel,
  };
}
