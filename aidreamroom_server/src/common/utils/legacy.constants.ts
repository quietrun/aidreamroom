export const ERROR_CODE = {
  EmailCodeError: 0,
  PasswordError: 1,
  EmailNotExist: 2,
  EmailExist: 3,
  PhoneCodeTimeLimit: 4,
  PhoneCodeSendFailed: 5,
  PhoneCodeError: 6,
} as const;

export const MODULE_LIST = [
  { moduleId: 0, moduleName: 'gpt-3.5-turbo', showName: '巴蒂' },
  { moduleId: 1, moduleName: 'gpt-5.4', showName: '亨德尔' },
  { moduleId: 2, moduleName: 'Claude', showName: '维瓦尔第' },
] as const;

export const DEFAULT_LIMIT_CONFIG = [
  { times: 50, moduleId: 1 },
  { times: 50, moduleId: 2 },
];

export const WORLD_TYPES = [
  { text: 'COC', id: 0, color: 'rgb(70,68,178)' },
  { text: 'DND', id: 1, color: 'rgb(191,20,22)' },
  { text: '武侠', id: 2, color: 'rgb(88,88,96)' },
  { text: '仙侠', id: 3, color: 'rgb(31,131,148)' },
  { text: '恋爱', id: 4, color: 'rgb(204,16,69)' },
  { text: '奇幻', id: 5, color: 'rgb(0,133,165)' },
  { text: '历史', id: 6, color: 'rgb(124,103,0)' },
  { text: '宫斗', id: 7, color: 'rgb(135,21,176)' },
  { text: '末世', id: 8, color: 'rgb(116,86,51)' },
  { text: '科幻', id: 9, color: 'rgb(0,134,255)' },
  { text: '赛博朋克', id: 10, color: 'rgb(160,128,0)' },
] as const;

export const MATERIAL_TYPES = [
  { text: '地点', id: 0, color: 'rgb(70,68,178)' },
  { text: '种族', id: 1, color: 'rgb(191,20,22)' },
  { text: '人物', id: 2, color: 'rgb(88,88,96)' },
  { text: '物品', id: 3, color: 'rgb(31,131,148)' },
  { text: '能力体系', id: 4, color: 'rgb(0,134,255)' },
  { text: '专有名词', id: 5, color: 'rgb(160,128,0)' },
  { text: '前置条件', id: 6, color: 'rgb(21,68,228)' },
] as const;

export const getModuleNameById = (id = 0) => {
  const item = MODULE_LIST.find((moduleInfo) => moduleInfo.moduleId === id);
  return item?.moduleName ?? MODULE_LIST[0].moduleName;
};
