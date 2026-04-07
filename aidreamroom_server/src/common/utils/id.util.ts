import { randomUUID } from 'crypto';

export const generateUuid = () => randomUUID().replace(/-/g, '');

export const generateNumericId = (length = 12) => {
  const digits = '0123456789';
  return Array.from({ length })
    .map(() => digits[Math.floor(Math.random() * digits.length)])
    .join('');
};
