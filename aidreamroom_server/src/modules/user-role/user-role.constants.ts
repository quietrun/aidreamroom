export const USER_ROLE_ATTRIBUTE_CONFIG = [
  {
    key: 'strength',
    label: 'Strength',
    cap: 99,
    recommendedMin: 15,
    recommendedMax: 90,
    description: 'Affects load, melee damage, and burst actions.',
  },
  {
    key: 'constitution',
    label: 'Constitution',
    cap: 99,
    recommendedMin: 15,
    recommendedMax: 90,
    description: 'Affects HP, resistance, and long-term stability.',
  },
  {
    key: 'size',
    label: 'Size',
    cap: 99,
    recommendedMin: 40,
    recommendedMax: 90,
    description: 'Affects frame, HP, and close combat build.',
  },
  {
    key: 'dexterity',
    label: 'Dexterity',
    cap: 99,
    recommendedMin: 15,
    recommendedMax: 90,
    description: 'Affects move speed, agility, and ranged performance.',
  },
  {
    key: 'appearance',
    label: 'Appearance',
    cap: 99,
    recommendedMin: 15,
    recommendedMax: 90,
    description: 'Affects persuasion, favorability, and attraction.',
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    cap: 99,
    recommendedMin: 40,
    recommendedMax: 90,
    description: 'Affects analysis and complex information handling.',
  },
  {
    key: 'power',
    label: 'Power',
    cap: 99,
    recommendedMin: 15,
    recommendedMax: 90,
    description: 'Affects summoning, magic points, and mental resistance.',
  },
  {
    key: 'education',
    label: 'Education',
    cap: 99,
    recommendedMin: 40,
    recommendedMax: 99,
    description: 'Affects growth, learning, and machinery mastery.',
  },
  {
    key: 'luck',
    label: 'Luck',
    cap: 99,
    recommendedMin: 15,
    recommendedMax: 90,
    description: 'Affects crits, drop chances, and random outcomes.',
  },
] as const;

export const USER_ROLE_ABILITY_CONFIG = [
  { key: 'fighting', label: 'Fighting', description: 'Close combat and direct confrontation.' },
  { key: 'shooting', label: 'Shooting', description: 'Ranged precision and firearm control.' },
  { key: 'summoning', label: 'Summoning', description: 'Rituals, contracts, and calling forces.' },
  { key: 'magic', label: 'Magic', description: 'Spell knowledge and stable casting.' },
  { key: 'general', label: 'General', description: 'Common skills and general execution.' },
  { key: 'machinery', label: 'Machinery', description: 'Tools, devices, and mechanical handling.' },
  { key: 'investigation', label: 'Investigation', description: 'Observation, tracking, and clue work.' },
] as const;

export type UserRoleAttributeKey = (typeof USER_ROLE_ATTRIBUTE_CONFIG)[number]['key'];
export type UserRoleAbilityKey = (typeof USER_ROLE_ABILITY_CONFIG)[number]['key'];

export type UserRoleAttributes = Record<UserRoleAttributeKey, number>;

export type UserRoleAbilityState = {
  abilityKey: UserRoleAbilityKey;
  abilityName: string;
  level: number;
  experience: number;
};

export const DEFAULT_ROLE_ATTRIBUTES: UserRoleAttributes = {
  strength: 50,
  constitution: 50,
  size: 50,
  dexterity: 50,
  appearance: 50,
  intelligence: 50,
  power: 50,
  education: 50,
  luck: 50,
};

export const DEFAULT_ROLE_EXPERIENCE = 0;
export const DEFAULT_ROLE_AGE = 24;
export const MAX_ROLE_ABILITY_LEVEL = 10;
export const MAX_ROLE_ATTRIBUTE_TOTAL = 550;

export function clampRoleAttribute(key: UserRoleAttributeKey, value: number) {
  const target = USER_ROLE_ATTRIBUTE_CONFIG.find((item) => item.key === key);
  const normalized = Number.isFinite(value) ? Math.round(value) : DEFAULT_ROLE_ATTRIBUTES[key];
  return Math.min(target?.cap ?? 99, Math.max(1, normalized));
}

export function clampAbilityLevel(value: number) {
  const normalized = Number.isFinite(value) ? Math.round(value) : 0;
  return Math.min(MAX_ROLE_ABILITY_LEVEL, Math.max(0, normalized));
}

export function clampNonNegative(value: number) {
  const normalized = Number.isFinite(value) ? Math.round(value) : 0;
  return Math.max(0, normalized);
}

export function computeRoleAttributeTotal(attributes: Partial<UserRoleAttributes>) {
  return USER_ROLE_ATTRIBUTE_CONFIG.reduce((total, item) => {
    return total + clampRoleAttribute(item.key, Number(attributes[item.key] ?? DEFAULT_ROLE_ATTRIBUTES[item.key]));
  }, 0);
}

export function createDefaultAbilityStates(): UserRoleAbilityState[] {
  return USER_ROLE_ABILITY_CONFIG.map((item) => ({
    abilityKey: item.key,
    abilityName: item.label,
    level: 0,
    experience: 0,
  }));
}

function resolveDamageBonusAndBuild(strength: number, size: number) {
  const total = strength + size;
  if (total <= 64) {
    return { damageBonus: '-2', build: -2 };
  }
  if (total <= 84) {
    return { damageBonus: '-1', build: -1 };
  }
  if (total <= 124) {
    return { damageBonus: '0', build: 0 };
  }
  if (total <= 164) {
    return { damageBonus: '+1D4', build: 1 };
  }
  if (total <= 204) {
    return { damageBonus: '+1D6', build: 2 };
  }

  const extra = Math.ceil((total - 204) / 80);
  return {
    damageBonus: `+${extra + 1}D6`,
    build: 2 + extra,
  };
}

function resolveMoveRate(age: number, strength: number, dexterity: number, size: number) {
  let base = 8;
  if (strength > size && dexterity > size) {
    base = 9;
  } else if (strength < size && dexterity < size) {
    base = 7;
  }

  if (age >= 40) base -= 1;
  if (age >= 50) base -= 1;
  if (age >= 60) base -= 1;
  if (age >= 70) base -= 1;
  if (age >= 80) base -= 1;

  return Math.max(1, base);
}

export function buildDerivedRoleStats(attributes: UserRoleAttributes, age: number) {
  const damage = resolveDamageBonusAndBuild(attributes.strength, attributes.size);

  return {
    maxHp: Math.max(1, Math.floor((attributes.constitution + attributes.size) / 10)),
    maxMp: Math.max(0, Math.floor(attributes.power / 5)),
    carryCapacity: attributes.strength * 5,
    pushLimit: attributes.strength * 10,
    damageBonus: damage.damageBonus,
    build: damage.build,
    moveRate: resolveMoveRate(age, attributes.strength, attributes.dexterity, attributes.size),
    shootBonus: Math.floor(attributes.dexterity / 10),
    socialBonus: Math.floor(attributes.appearance / 10),
    spellResistance: Math.floor(attributes.power / 5),
    learningBonus: Math.floor(attributes.education / 10),
    critBonus: Math.floor(attributes.luck / 10),
  };
}
