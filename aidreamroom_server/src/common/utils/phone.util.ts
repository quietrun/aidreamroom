export const isChinesePhoneNumber = (value: string) =>
  /^1[3456789]\d{9}$/.test(value);
