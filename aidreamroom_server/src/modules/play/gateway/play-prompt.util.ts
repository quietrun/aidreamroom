import { MATERIAL_TYPES, WORLD_TYPES } from '../../../common/utils/legacy.constants';

export const createPlayPrompt = (
  plotInfo: string,
  plotConditions: Array<{ name: string; descript: string; condition: string[]; plotType?: number }>,
  previousMessage: string,
  action: string,
  itemList: string,
  character: Record<string, unknown>,
) => {
  const characterInfo = { ...(character.info as Record<string, unknown>) };
  delete characterInfo.uuid;

  const plotText = plotConditions
    .map((item) => `如果满足“${item.condition.join('，且')}”，则进入剧情“${item.name}:${item.descript}”`)
    .join('，');

  return `请根据以下角色信息、剧情描述、剧情条件、前文和玩家行动，使用第三人称续写 200 字左右的下一步故事。若玩家行动满足剧情条件，请推进到对应剧情；若玩家行动与世界设定不符，请通过叙事把玩家引导回剧情。\n角色信息：${JSON.stringify(
    characterInfo,
  )}\n剧情描述：${plotInfo}\n当前持有物品：${itemList}\n剧情条件：${plotText}\n前文：${previousMessage}\n玩家行动：${action}\n你必须严格返回 JSON 字符串，格式为 {"message":"剧情文本","nextPlot":"命中的剧情名称，没有则为空字符串","values":["涉及到的物品或状态"]}`;
};

export const formatKnowledge = (knowledgeList: Array<Record<string, unknown>>) =>
  knowledgeList
    .map((item) => {
      const typeId = Number(item.materialType ?? 0);
      return `名称:${String(item.name ?? '')}, 描述:${String(item.descript ?? '')}, 类型:${MATERIAL_TYPES[typeId]?.text ?? ''}`;
    })
    .join('\n');

export const formatWorldTypes = (worldTypeValue: string) =>
  String(worldTypeValue ?? '')
    .split(',')
    .filter(Boolean)
    .map((value) => WORLD_TYPES[Number(value)]?.text ?? value)
    .join(',');
