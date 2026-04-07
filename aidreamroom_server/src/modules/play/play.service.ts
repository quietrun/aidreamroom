import { Injectable } from '@nestjs/common';

import { LegacyDbService } from '../../common/database/legacy-db.service';
import {
  DEFAULT_LIMIT_CONFIG,
  MODULE_LIST,
} from '../../common/utils/legacy.constants';
import { generateUuid } from '../../common/utils/id.util';
import { normalizeTimestamp } from '../../common/utils/number.util';

@Injectable()
export class PlayService {
  constructor(private readonly db: LegacyDbService) {}

  async create(
    creatorId: string,
    payload: { plot_id: string; character_id: string; model_id?: number },
  ) {
    const info = {
      uuid: generateUuid(),
      creator: creatorId,
      updateTime: normalizeTimestamp(),
      plot_id: payload.plot_id,
      character_id: payload.character_id,
      currentPlotId: payload.plot_id,
      model_id: payload.model_id ?? 1,
    };
    await this.db.replaceInto('play_config', info);
    return info;
  }

  async latestGame(creatorId: string) {
    const game = await this.db.findFirst<Record<string, unknown>>(
      'select * from play_config where creator = ? order by updateTime desc',
      [creatorId],
    );
    if (!game) {
      return { result: -1 };
    }

    const [plot, character] = await Promise.all([
      this.db.findFirst('select * from plot_info_table where uuid = ?', [String(game.plot_id ?? '')]),
      this.db.findFirst('select * from character_info_table where uuid = ?', [String(game.character_id ?? '')]),
    ]);

    return { result: 0, game, plot, character };
  }

  async queryGameConfig(id: string) {
    const game = await this.db.findFirst<Record<string, unknown>>('select * from play_config where uuid = ?', [id]);
    if (!game) {
      return { game: null, plot: null, character: null, plotList: [], elementList: [], knowledge: [] };
    }

    const [plot, character, plotList, elementList, knowledge] = await Promise.all([
      this.db.findFirst('select * from plot_info_table where uuid = ?', [String(game.plot_id ?? '')]),
      this.db.findFirst('select * from character_info_table where uuid = ?', [String(game.character_id ?? '')]),
      this.db.query('select * from plot_item_table where parent = ?', [String(game.plot_id ?? '')]),
      this.db.query('select * from element_item_table'),
      this.db.query('select * from plot_knowledge_table where parent = ?', [String(game.plot_id ?? '')]),
    ]);

    return { game, plot, character, plotList, elementList, knowledge };
  }

  async queryRemainTimes(userId: string) {
    const current = await this.db.findFirst<{ update_date: number; limit_config: string }>(
      'select * from chat_limit_table where user_id = ?',
      [userId],
    );
    let config = DEFAULT_LIMIT_CONFIG.map((item) => ({ ...item }));

    if (current) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      const currentDayStart = date.getTime();
      if (currentDayStart > Number(current.update_date ?? 0)) {
        await this.db.replaceInto('chat_limit_table', {
          user_id: userId,
          update_date: normalizeTimestamp(),
          limit_config: JSON.stringify(config),
        });
      } else {
        config = JSON.parse(current.limit_config ?? '[]') as Array<{ times: number; moduleId: number }>;
      }
    } else {
      await this.db.replaceInto('chat_limit_table', {
        user_id: userId,
        update_date: normalizeTimestamp(),
        limit_config: JSON.stringify(config),
      });
    }

    return config;
  }

  queryModuleList() {
    return MODULE_LIST;
  }

  async queryHistory(creatorId: string) {
    const games = await this.db.query<Record<string, unknown>>('select * from play_config where creator = ?', [creatorId]);
    const result: Array<Record<string, unknown>> = [];
    for (const game of games) {
      const [plot, character] = await Promise.all([
        this.db.findFirst('select * from plot_info_table where uuid = ?', [String(game.plot_id ?? '')]),
        this.db.findFirst('select * from character_info_table where uuid = ?', [String(game.character_id ?? '')]),
      ]);
      result.push({
        gameId: game.uuid,
        plot,
        character,
      });
    }
    return result;
  }

  async saveRuntimeState(
    gameId: string,
    currentPlotId: string,
    currentItems: string,
    imageList: string[],
    userId: string,
    limitConfig: Array<{ times: number; moduleId: number }>,
  ) {
    await this.db.execute(
      'update play_config set currentPlotId = ?, currentItems = ?, image_list = ? where uuid = ?',
      [currentPlotId, currentItems, imageList.join(','), gameId],
    );
    await this.db.execute(
      'update chat_limit_table set update_date = ?, limit_config = ? where user_id = ?',
      [normalizeTimestamp(), JSON.stringify(limitConfig), userId],
    );
  }

  markFinished(gameId: string) {
    return this.db.execute('update play_config set isFinish = ? where uuid = ?', [true, gameId]);
  }
}
