import { Injectable } from '@nestjs/common';

import { LegacyDbService } from '../../common/database/legacy-db.service';
import { generateUuid } from '../../common/utils/id.util';
import { normalizeTimestamp } from '../../common/utils/number.util';

@Injectable()
export class CharactersService {
  constructor(private readonly db: LegacyDbService) {}

  async saveCharacter(
    creatorId: string,
    payload: {
      info: Record<string, unknown>;
      image?: string;
      worldType?: string | number;
      metrics?: string;
      uuid?: string;
    },
  ) {
    const record = {
      uuid: payload.uuid ?? generateUuid(),
      creater: creatorId,
      updateTime: normalizeTimestamp(),
      info: JSON.stringify(payload.info),
      image: payload.image ?? '',
      worldType: payload.worldType?.toString() ?? '',
      metrics: payload.metrics ?? '',
    };

    await this.db.replaceInto('character_info_table', record);
    return record;
  }

  async removeCharacters(ids: string[]) {
    for (const uuid of ids) {
      await this.db.execute('delete from character_info_table where uuid = ?', [uuid]);
    }
  }

  listByCreator(creatorId: string) {
    return this.db.query('select * from character_info_table where creater = ?', [creatorId]);
  }

  listAll() {
    return this.db.query('select * from character_info_table');
  }
}
