export const normalizeTimestamp = () => Date.now();

export const toSafeStringArray = (value?: string | null) =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
