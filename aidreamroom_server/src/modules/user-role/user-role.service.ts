import { Injectable } from '@nestjs/common';

import { LegacyDbService } from '../../common/database/legacy-db.service';
import { generateUuid } from '../../common/utils/id.util';
import { normalizeTimestamp } from '../../common/utils/number.util';
import {
  DEFAULT_ROLE_AGE,
  DEFAULT_ROLE_ATTRIBUTES,
  DEFAULT_ROLE_EXPERIENCE,
  USER_ROLE_ABILITY_CONFIG,
  UserRoleAbilityKey,
  UserRoleAbilityState,
  UserRoleAttributeKey,
  UserRoleAttributes,
  buildDerivedRoleStats,
  clampAbilityLevel,
  clampNonNegative,
  clampRoleAttribute,
  createDefaultAbilityStates,
} from './user-role.constants';

type UserRoleRecord = {
  uuid: string;
  user_id: string;
  name: string;
  gender: string | null;
  age: number | null;
  appearance_style: string | null;
  strength: number | null;
  constitution: number | null;
  size: number | null;
  dexterity: number | null;
  appearance: number | null;
  intelligence: number | null;
  power: number | null;
  education: number | null;
  luck: number | null;
  experience: number | null;
  items: string | null;
  worlds: string | null;
  createTime: number | null;
  updateTime: number | null;
};

type UserRoleAbilityRow = {
  role_id: string;
  ability_key: string;
  ability_name: string | null;
  level: number | null;
  experience: number | null;
};

type SaveUserRolePayload = {
  name: string;
  gender: string;
  age: number;
  appearanceStyle?: string;
  strength: number;
  constitution: number;
  size: number;
  dexterity: number;
  appearance: number;
  intelligence: number;
  power: number;
  education: number;
  luck: number;
  experience?: number;
  items?: string[];
  worlds?: string[];
  abilities?: Array<{
    abilityKey: string;
    level: number;
    experience?: number;
  }>;
};

@Injectable()
export class UserRoleService {
  constructor(private readonly db: LegacyDbService) {}

  async exists(userId: string) {
    const row = await this.findRoleRowByUserId(userId);
    return Boolean(row);
  }

  async queryProfile(userId: string) {
    const row = await this.findRoleRowByUserId(userId);
    if (!row) {
      return null;
    }

    return this.buildRoleResponse(row);
  }

  async create(userId: string, payload: SaveUserRolePayload) {
    const current = await this.findRoleRowByUserId(userId);
    if (current) {
      return null;
    }

    return this.saveRole(userId, payload, null);
  }

  async update(userId: string, payload: SaveUserRolePayload) {
    const current = await this.findRoleRowByUserId(userId);
    if (!current) {
      return null;
    }

    return this.saveRole(userId, payload, current);
  }

  private async saveRole(
    userId: string,
    payload: SaveUserRolePayload,
    current: UserRoleRecord | null,
  ) {
    const now = normalizeTimestamp();
    const attributes = this.normalizeAttributes(payload);
    const roleId = current?.uuid ?? generateUuid();
    const roleRecord = {
      uuid: roleId,
      user_id: userId,
      name: payload.name.trim(),
      gender: payload.gender?.trim() || 'unknown',
      age: Math.min(120, Math.max(1, Math.round(payload.age || DEFAULT_ROLE_AGE))),
      appearance_style: payload.appearanceStyle?.trim() || '',
      strength: attributes.strength,
      constitution: attributes.constitution,
      size: attributes.size,
      dexterity: attributes.dexterity,
      appearance: attributes.appearance,
      intelligence: attributes.intelligence,
      power: attributes.power,
      education: attributes.education,
      luck: attributes.luck,
      experience: clampNonNegative(payload.experience ?? Number(current?.experience ?? DEFAULT_ROLE_EXPERIENCE)),
      items: JSON.stringify(this.normalizeStringList(payload.items, current?.items)),
      worlds: JSON.stringify(this.normalizeStringList(payload.worlds, current?.worlds)),
      createTime: current?.createTime ?? now,
      updateTime: now,
    };

    await this.db.replaceInto('user_role_table', roleRecord);
    await this.saveAbilities(roleId, payload.abilities);

    const latest = await this.findRoleRowByUserId(userId);
    return latest ? this.buildRoleResponse(latest) : null;
  }

  private async saveAbilities(
    roleId: string,
    abilities?: Array<{
      abilityKey: string;
      level: number;
      experience?: number;
    }>,
  ) {
    const validAbilityKeys = new Set(USER_ROLE_ABILITY_CONFIG.map((item) => item.key));
    const inputMap = new Map(
      (abilities ?? [])
        .filter((item) => validAbilityKeys.has(item.abilityKey as UserRoleAbilityKey))
        .map((item) => [
          item.abilityKey as UserRoleAbilityKey,
          {
            level: clampAbilityLevel(Number(item.level)),
            experience: clampNonNegative(Number(item.experience ?? 0)),
          },
        ]),
    );

    const existingRows = await this.db.query<UserRoleAbilityRow>(
      'select * from user_role_ability_table where role_id = ?',
      [roleId],
    );
    const existingMap = new Map(
      existingRows.map((item) => [
        item.ability_key,
        {
          level: clampAbilityLevel(Number(item.level ?? 0)),
          experience: clampNonNegative(Number(item.experience ?? 0)),
        },
      ]),
    );

    for (const item of USER_ROLE_ABILITY_CONFIG) {
      const next = inputMap.get(item.key) ?? existingMap.get(item.key) ?? { level: 0, experience: 0 };
      await this.db.replaceInto('user_role_ability_table', {
        role_id: roleId,
        ability_key: item.key,
        ability_name: item.label,
        level: next.level,
        experience: next.experience,
      });
    }
  }

  private async buildRoleResponse(row: UserRoleRecord) {
    const attributes = this.normalizeAttributes({
      strength: Number(row.strength ?? DEFAULT_ROLE_ATTRIBUTES.strength),
      constitution: Number(row.constitution ?? DEFAULT_ROLE_ATTRIBUTES.constitution),
      size: Number(row.size ?? DEFAULT_ROLE_ATTRIBUTES.size),
      dexterity: Number(row.dexterity ?? DEFAULT_ROLE_ATTRIBUTES.dexterity),
      appearance: Number(row.appearance ?? DEFAULT_ROLE_ATTRIBUTES.appearance),
      intelligence: Number(row.intelligence ?? DEFAULT_ROLE_ATTRIBUTES.intelligence),
      power: Number(row.power ?? DEFAULT_ROLE_ATTRIBUTES.power),
      education: Number(row.education ?? DEFAULT_ROLE_ATTRIBUTES.education),
      luck: Number(row.luck ?? DEFAULT_ROLE_ATTRIBUTES.luck),
    });
    const age = Math.min(120, Math.max(1, Number(row.age ?? DEFAULT_ROLE_AGE)));
    const abilityRows = await this.db.query<UserRoleAbilityRow>(
      'select * from user_role_ability_table where role_id = ?',
      [row.uuid],
    );

    return {
      uuid: row.uuid,
      userId: row.user_id,
      name: row.name,
      gender: row.gender ?? 'unknown',
      age,
      appearanceStyle: row.appearance_style ?? '',
      experience: clampNonNegative(Number(row.experience ?? DEFAULT_ROLE_EXPERIENCE)),
      items: this.parseStringList(row.items),
      worlds: this.parseStringList(row.worlds),
      attributes,
      abilities: this.normalizeAbilities(abilityRows),
      derived: buildDerivedRoleStats(attributes, age),
      createTime: Number(row.createTime ?? 0),
      updateTime: Number(row.updateTime ?? 0),
    };
  }

  private normalizeAttributes(payload: Partial<Record<UserRoleAttributeKey, number>>): UserRoleAttributes {
    return {
      strength: clampRoleAttribute('strength', Number(payload.strength ?? DEFAULT_ROLE_ATTRIBUTES.strength)),
      constitution: clampRoleAttribute(
        'constitution',
        Number(payload.constitution ?? DEFAULT_ROLE_ATTRIBUTES.constitution),
      ),
      size: clampRoleAttribute('size', Number(payload.size ?? DEFAULT_ROLE_ATTRIBUTES.size)),
      dexterity: clampRoleAttribute('dexterity', Number(payload.dexterity ?? DEFAULT_ROLE_ATTRIBUTES.dexterity)),
      appearance: clampRoleAttribute('appearance', Number(payload.appearance ?? DEFAULT_ROLE_ATTRIBUTES.appearance)),
      intelligence: clampRoleAttribute(
        'intelligence',
        Number(payload.intelligence ?? DEFAULT_ROLE_ATTRIBUTES.intelligence),
      ),
      power: clampRoleAttribute('power', Number(payload.power ?? DEFAULT_ROLE_ATTRIBUTES.power)),
      education: clampRoleAttribute('education', Number(payload.education ?? DEFAULT_ROLE_ATTRIBUTES.education)),
      luck: clampRoleAttribute('luck', Number(payload.luck ?? DEFAULT_ROLE_ATTRIBUTES.luck)),
    };
  }

  private normalizeAbilities(rows: UserRoleAbilityRow[]): UserRoleAbilityState[] {
    const existingMap = new Map(rows.map((item) => [item.ability_key, item]));

    return createDefaultAbilityStates().map((item) => {
      const existing = existingMap.get(item.abilityKey);
      return {
        abilityKey: item.abilityKey,
        abilityName: existing?.ability_name || item.abilityName,
        level: clampAbilityLevel(Number(existing?.level ?? item.level)),
        experience: clampNonNegative(Number(existing?.experience ?? item.experience)),
      };
    });
  }

  private normalizeStringList(input: string[] | undefined, fallbackRaw?: string | null) {
    if (input) {
      return input.map((item) => item.trim()).filter(Boolean);
    }

    return this.parseStringList(fallbackRaw);
  }

  private parseStringList(value?: string | null) {
    if (!value) {
      return [];
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  private findRoleRowByUserId(userId: string) {
    return this.db.findFirst<UserRoleRecord>(
      'select * from user_role_table where user_id = ?',
      [userId],
    );
  }
}
