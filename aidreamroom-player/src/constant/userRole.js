export const roleAttributeDefinitions = [
  {
    key: 'strength',
    label: '力量',
    recommendedRange: '15-90',
    recommendedMin: 15,
    recommendedMax: 90,
    diceRule: '3D6 x 5',
    description: '影响负重、格斗伤害与爆发动作。',
  },
  {
    key: 'constitution',
    label: '体质',
    recommendedRange: '15-90',
    recommendedMin: 15,
    recommendedMax: 90,
    diceRule: '3D6 x 5',
    description: '影响血量、异常抗性与成长稳定性。',
  },
  {
    key: 'size',
    label: '体型',
    recommendedRange: '40-90',
    recommendedMin: 40,
    recommendedMax: 90,
    diceRule: '(2D6 + 6) x 5',
    description: '影响体格、生命值与近战构筑。',
  },
  {
    key: 'dexterity',
    label: '敏捷',
    recommendedRange: '15-90',
    recommendedMin: 15,
    recommendedMax: 90,
    diceRule: '3D6 x 5',
    description: '影响行动速度、灵活性与射击表现。',
  },
  {
    key: 'appearance',
    label: '外貌',
    recommendedRange: '15-90',
    recommendedMin: 15,
    recommendedMax: 90,
    diceRule: '3D6 x 5',
    description: '影响话术、吸引力与 NPC 好感。',
  },
  {
    key: 'intelligence',
    label: '智力',
    recommendedRange: '40-90',
    recommendedMin: 40,
    recommendedMax: 90,
    diceRule: '(2D6 + 6) x 5',
    description: '影响分析、推理与复杂信息处理。',
  },
  {
    key: 'power',
    label: '意志',
    recommendedRange: '15-90',
    recommendedMin: 15,
    recommendedMax: 90,
    diceRule: '3D6 x 5',
    description: '影响召唤、灵术、魔法值与精神抗性。',
  },
  {
    key: 'education',
    label: '教育',
    recommendedRange: '40-99',
    recommendedMin: 40,
    recommendedMax: 99,
    diceRule: '(2D6 + 6) x 5',
    description: '影响经验获取、学习效率与器械成长。',
  },
  {
    key: 'luck',
    label: '幸运',
    recommendedRange: '15-90',
    recommendedMin: 15,
    recommendedMax: 90,
    diceRule: '3D6 x 5',
    description: '影响暴击、掉落概率与随机收益。',
  },
];

export const roleAbilityDefinitions = [
  { key: 'fighting', label: '格斗', description: '近战、肉搏与正面对抗。' },
  { key: 'shooting', label: '射击', description: '远程命中、压制与武器控制。' },
  { key: 'summoning', label: '召唤', description: '召唤仪式、契约与异界沟通。' },
  { key: 'magic', label: '魔法', description: '法术理解、释放与稳定性。' },
  { key: 'general', label: '通用', description: '通识技巧与日常执行能力。' },
  { key: 'machinery', label: '器械', description: '机械、工具与设备掌握。' },
  { key: 'investigation', label: '侦查', description: '观察、搜证、追踪与发现线索。' },
];

export const genderOptions = [
  { label: '男', value: '男' },
  { label: '女', value: '女' },
  { label: '非二元', value: '非二元' },
  { label: '未知', value: '未知' },
];

export const MAX_ROLE_ATTRIBUTE_TOTAL = 550;

const defaultAttributeValue = 50;

function clamp(value, min, max, fallback) {
  const next = Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
  return Math.min(max, Math.max(min, next));
}

const genderValueMap = new Map([
  ['男', '男'],
  ['male', '男'],
  ['Male', '男'],
  ['女', '女'],
  ['female', '女'],
  ['Female', '女'],
  ['非二元', '非二元'],
  ['non-binary', '非二元'],
  ['Non-binary', '非二元'],
  ['未知', '未知'],
  ['unknown', '未知'],
  ['Unknown', '未知'],
]);

function splitTextList(value = '') {
  return value
    .split(/\r?\n|,|，/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function computeDamageBonusAndBuild(strength, size) {
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

function computeMoveRate(age, strength, dexterity, size) {
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

export function normalizeGenderValue(value) {
  return genderValueMap.get(value) || value || '未知';
}

export function getDisplayGender(value) {
  return normalizeGenderValue(value);
}

export function createDefaultRoleForm() {
  return {
    name: '',
    gender: '未知',
    age: 24,
    appearanceStyle: '',
    experience: 0,
    itemsText: '',
    worldsText: '',
    strength: defaultAttributeValue,
    constitution: defaultAttributeValue,
    size: defaultAttributeValue,
    dexterity: defaultAttributeValue,
    appearance: defaultAttributeValue,
    intelligence: defaultAttributeValue,
    power: defaultAttributeValue,
    education: defaultAttributeValue,
    luck: defaultAttributeValue,
    abilities: roleAbilityDefinitions.map((item) => ({
      abilityKey: item.key,
      abilityName: item.label,
      level: 0,
      experience: 0,
    })),
  };
}

export function createDefaultAttributeLimits(attributes = {}) {
  return roleAttributeDefinitions.reduce((result, item) => {
    const currentValue = Number(attributes?.[item.key]);
    result[item.key] = {
      min: Number.isFinite(currentValue) ? Math.min(item.recommendedMin, currentValue) : item.recommendedMin,
      max: Number.isFinite(currentValue) ? Math.max(item.recommendedMax, currentValue) : item.recommendedMax,
    };
    return result;
  }, {});
}

export function hydrateRoleForm(role) {
  const base = createDefaultRoleForm();
  if (!role) {
    return base;
  }

  const abilityMap = new Map((role.abilities || []).map((item) => [item.abilityKey, item]));
  const attributes = role.attributes || {};

  return {
    ...base,
    name: role.name || '',
    gender: normalizeGenderValue(role.gender),
    age: clamp(role.age, 1, 120, base.age),
    appearanceStyle: role.appearanceStyle || '',
    experience: clamp(role.experience, 0, 9999999, 0),
    itemsText: (role.items || []).join('\n'),
    worldsText: (role.worlds || []).join('\n'),
    strength: clamp(attributes.strength, 1, 99, defaultAttributeValue),
    constitution: clamp(attributes.constitution, 1, 99, defaultAttributeValue),
    size: clamp(attributes.size, 1, 99, defaultAttributeValue),
    dexterity: clamp(attributes.dexterity, 1, 99, defaultAttributeValue),
    appearance: clamp(attributes.appearance, 1, 99, defaultAttributeValue),
    intelligence: clamp(attributes.intelligence, 1, 99, defaultAttributeValue),
    power: clamp(attributes.power, 1, 99, defaultAttributeValue),
    education: clamp(attributes.education, 1, 99, defaultAttributeValue),
    luck: clamp(attributes.luck, 1, 99, defaultAttributeValue),
    abilities: roleAbilityDefinitions.map((item) => {
      const current = abilityMap.get(item.key);
      return {
        abilityKey: item.key,
        abilityName: item.label,
        level: clamp(current?.level, 0, 10, 0),
        experience: clamp(current?.experience, 0, 9999999, 0),
      };
    }),
  };
}

export function buildRolePayload(form, includeProgress = true) {
  const payload = {
    name: (form.name || '').trim(),
    gender: normalizeGenderValue(form.gender),
    age: clamp(form.age, 1, 120, 24),
    appearanceStyle: (form.appearanceStyle || '').trim(),
  };

  roleAttributeDefinitions.forEach((item) => {
    payload[item.key] = clamp(form[item.key], 1, 99, defaultAttributeValue);
  });

  if (includeProgress) {
    payload.experience = clamp(form.experience, 0, 9999999, 0);
    payload.items = splitTextList(form.itemsText);
    payload.worlds = splitTextList(form.worldsText);
    payload.abilities = (form.abilities || []).map((item) => ({
      abilityKey: item.abilityKey,
      level: clamp(item.level, 0, 10, 0),
      experience: clamp(item.experience, 0, 9999999, 0),
    }));
  }

  return payload;
}

export function computeRoleDerivedStats(source) {
  const strength = clamp(source?.strength ?? source?.attributes?.strength, 1, 99, defaultAttributeValue);
  const constitution = clamp(source?.constitution ?? source?.attributes?.constitution, 1, 99, defaultAttributeValue);
  const size = clamp(source?.size ?? source?.attributes?.size, 1, 99, defaultAttributeValue);
  const dexterity = clamp(source?.dexterity ?? source?.attributes?.dexterity, 1, 99, defaultAttributeValue);
  const appearance = clamp(source?.appearance ?? source?.attributes?.appearance, 1, 99, defaultAttributeValue);
  const power = clamp(source?.power ?? source?.attributes?.power, 1, 99, defaultAttributeValue);
  const education = clamp(source?.education ?? source?.attributes?.education, 1, 99, defaultAttributeValue);
  const luck = clamp(source?.luck ?? source?.attributes?.luck, 1, 99, defaultAttributeValue);
  const age = clamp(source?.age, 1, 120, 24);

  const damage = computeDamageBonusAndBuild(strength, size);

  return {
    maxHp: Math.max(1, Math.floor((constitution + size) / 10)),
    maxMp: Math.max(0, Math.floor(power / 5)),
    carryCapacity: strength * 5,
    pushLimit: strength * 10,
    damageBonus: damage.damageBonus,
    build: damage.build,
    moveRate: computeMoveRate(age, strength, dexterity, size),
    shootBonus: Math.floor(dexterity / 10),
    socialBonus: Math.floor(appearance / 10),
    spellResistance: Math.floor(power / 5),
    learningBonus: Math.floor(education / 10),
    critBonus: Math.floor(luck / 10),
  };
}

export function computeRoleAttributeTotal(source) {
  return roleAttributeDefinitions.reduce((total, item) => {
    return total + clamp(source?.[item.key] ?? source?.attributes?.[item.key], 1, 99, defaultAttributeValue);
  }, 0);
}

export function computeRoleAttributeMinTotal() {
  return roleAttributeDefinitions.reduce((total, item) => total + item.recommendedMin, 0);
}

function randomInt(min, max) {
  if (max <= min) {
    return min;
  }

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(input) {
  const result = [...input];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function createRandomRoleAttributes(targetTotal = MAX_ROLE_ATTRIBUTE_TOTAL) {
  const minTotal = computeRoleAttributeMinTotal();
  const maxTotal = roleAttributeDefinitions.reduce((total, item) => total + item.recommendedMax, 0);
  const normalizedTarget = clamp(targetTotal, minTotal, maxTotal, MAX_ROLE_ATTRIBUTE_TOTAL);
  const shuffledDefinitions = shuffleArray(roleAttributeDefinitions);
  const values = {};
  let remaining = normalizedTarget - minTotal;

  shuffledDefinitions.forEach((item, index) => {
    const capacity = item.recommendedMax - item.recommendedMin;
    const remainingCapacity = shuffledDefinitions
      .slice(index + 1)
      .reduce((total, nextItem) => total + (nextItem.recommendedMax - nextItem.recommendedMin), 0);
    const minExtra = Math.max(0, remaining - remainingCapacity);
    const maxExtra = Math.min(capacity, remaining);
    const extra = randomInt(minExtra, maxExtra);

    values[item.key] = item.recommendedMin + extra;
    remaining -= extra;
  });

  return roleAttributeDefinitions.reduce((result, item) => {
    result[item.key] = values[item.key] ?? item.recommendedMin;
    return result;
  }, {});
}
