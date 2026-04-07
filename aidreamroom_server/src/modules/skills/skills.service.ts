import { Injectable } from '@nestjs/common';

import { LegacyDbService } from '../../common/database/legacy-db.service';
import { generateUuid } from '../../common/utils/id.util';
import { normalizeTimestamp } from '../../common/utils/number.util';
import { UserRoleService } from '../user-role/user-role.service';
import {
  DEFAULT_SKILL_DEFINITIONS,
  SkillFormulaConfig,
  SkillRequirement,
  evaluateSkillDamage,
  normalizeSkillFormulaConfig,
  normalizeSkillRequirements,
  resolveSkillAvailability,
} from './skills.constants';

type SkillRecord = {
  uuid: string;
  name: string;
  description: string | null;
  formula_label: string | null;
  formula_config: string | null;
  is_active: boolean | null;
  createTime: number | null;
  updateTime: number | null;
};

type SkillRequirementRow = {
  skill_id: string;
  ability_key: string;
  ability_name: string | null;
  required_level: number | null;
};

type SaveSkillPayload = {
  name: string;
  description?: string;
  formulaLabel?: string;
  formulaConfig?: unknown;
  requirements?: Array<{
    abilityKey: string;
    requiredLevel: number;
  }>;
  isActive?: boolean;
};

@Injectable()
export class SkillsService {
  constructor(
    private readonly db: LegacyDbService,
    private readonly userRoleService: UserRoleService,
  ) {}

  async queryListByUser(userId: string) {
    await this.ensureDefaultSkills();

    const [skillRows, requirementRows, role] = await Promise.all([
      this.db.query<SkillRecord>(
        'select * from skill_table where is_active = ? order by updateTime desc, createTime desc',
        [true],
      ),
      this.db.query<SkillRequirementRow>('select * from skill_requirement_table'),
      this.userRoleService.queryProfile(userId),
    ]);

    const requirementMap = this.createRequirementMap(requirementRows);
    return skillRows.map((row) => this.buildSkillResponse(row, requirementMap.get(row.uuid) ?? [], role));
  }

  async queryDetailByUser(userId: string, skillId: string) {
    await this.ensureDefaultSkills();

    const [row, requirementRows, role] = await Promise.all([
      this.findSkillRowById(skillId),
      this.db.query<SkillRequirementRow>(
        'select * from skill_requirement_table where skill_id = ?',
        [skillId],
      ),
      this.userRoleService.queryProfile(userId),
    ]);

    if (!row) {
      return null;
    }

    return this.buildSkillResponse(row, this.normalizeRequirementsFromRows(requirementRows), role);
  }

  async create(payload: SaveSkillPayload) {
    await this.ensureDefaultSkills();
    return this.saveSkill(payload, null);
  }

  async update(skillId: string, payload: SaveSkillPayload) {
    await this.ensureDefaultSkills();
    const current = await this.findSkillRowById(skillId);
    if (!current) {
      return null;
    }

    return this.saveSkill(payload, current);
  }

  async ensureCatalog() {
    await this.ensureDefaultSkills();
  }

  private async saveSkill(payload: SaveSkillPayload, current: SkillRecord | null) {
    const now = normalizeTimestamp();
    const skillId = current?.uuid ?? generateUuid();
    const formulaConfig = normalizeSkillFormulaConfig(
      (payload.formulaConfig ?? null) as Record<string, unknown> | null,
    );
    const requirements = normalizeSkillRequirements(payload.requirements);

    await this.db.replaceInto('skill_table', {
      uuid: skillId,
      name: payload.name.trim(),
      description: payload.description?.trim() || '',
      formula_label: payload.formulaLabel?.trim() || '',
      formula_config: JSON.stringify(formulaConfig),
      is_active: payload.isActive ?? current?.is_active ?? true,
      createTime: current?.createTime ?? now,
      updateTime: now,
    });

    await this.db.execute('delete from skill_requirement_table where skill_id = ?', [skillId]);
    await this.saveRequirements(skillId, requirements);

    const latest = await this.findSkillRowById(skillId);
    if (!latest) {
      return null;
    }

    return this.buildSkillResponse(latest, requirements, null);
  }

  private async ensureDefaultSkills() {
    const existing = await this.db.findFirst<{ uuid: string }>('select uuid from skill_table limit 1');
    if (existing) {
      return;
    }

    const now = normalizeTimestamp();
    for (const skill of DEFAULT_SKILL_DEFINITIONS) {
      await this.db.replaceInto('skill_table', {
        uuid: skill.uuid,
        name: skill.name,
        description: skill.description,
        formula_label: skill.formulaLabel,
        formula_config: JSON.stringify(skill.formulaConfig),
        is_active: true,
        createTime: now,
        updateTime: now,
      });

      await this.saveRequirements(skill.uuid, normalizeSkillRequirements(skill.requirements));
    }
  }

  private async saveRequirements(skillId: string, requirements: SkillRequirement[]) {
    for (const requirement of requirements) {
      await this.db.replaceInto('skill_requirement_table', {
        skill_id: skillId,
        ability_key: requirement.abilityKey,
        ability_name: requirement.abilityName,
        required_level: requirement.requiredLevel,
      });
    }
  }

  private buildSkillResponse(
    row: SkillRecord,
    requirements: SkillRequirement[],
    role: Awaited<ReturnType<UserRoleService['queryProfile']>>,
  ) {
    const formulaConfig = this.parseFormulaConfig(row.formula_config);
    const abilityChecks = requirements.map((requirement) => {
      const availability = role
        ? resolveSkillAvailability(requirement, role.abilities)
        : {
            met: false,
            currentLevel: 0,
            missingLevel: requirement.requiredLevel,
          };

      return {
        abilityKey: requirement.abilityKey,
        abilityName: requirement.abilityName,
        requiredLevel: requirement.requiredLevel,
        currentLevel: availability.currentLevel,
        missingLevel: availability.missingLevel,
        met: availability.met,
      };
    });

    const available = abilityChecks.every((item) => item.met);
    const damagePreview = role
      ? evaluateSkillDamage(formulaConfig, role.attributes, role.abilities)
      : null;

    return {
      uuid: row.uuid,
      name: row.name,
      description: row.description ?? '',
      formulaLabel: row.formula_label ?? '',
      formulaConfig,
      requirements: abilityChecks,
      available,
      damagePreview,
      createTime: Number(row.createTime ?? 0),
      updateTime: Number(row.updateTime ?? 0),
    };
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

  private normalizeRequirementsFromRows(rows: SkillRequirementRow[]) {
    return normalizeSkillRequirements(
      rows.map((item) => ({
        abilityKey: item.ability_key,
        requiredLevel: Number(item.required_level ?? 0),
      })),
    );
  }

  private createRequirementMap(rows: SkillRequirementRow[]) {
    const map = new Map<string, SkillRequirement[]>();

    for (const row of rows) {
      const list = map.get(row.skill_id) ?? [];
      list.push({
        abilityKey: row.ability_key as SkillRequirement['abilityKey'],
        abilityName: row.ability_name ?? row.ability_key,
        requiredLevel: Number(row.required_level ?? 0),
      });
      map.set(row.skill_id, list);
    }

    for (const [key, list] of map) {
      map.set(key, normalizeSkillRequirements(list));
    }

    return map;
  }

  private findSkillRowById(skillId: string) {
    return this.db.findFirst<SkillRecord>('select * from skill_table where uuid = ?', [skillId]);
  }
}
