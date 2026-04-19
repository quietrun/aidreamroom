import { ItemAffix } from '../items/items.constants';

export const WAREHOUSE_ENTRY_TYPES = ['item', 'skill_card'] as const;
export const DEFAULT_WAREHOUSE_CAPACITY = 50;
export const DEFAULT_WAREHOUSE_EXPAND_AMOUNT = 10;
export const MAX_WAREHOUSE_CAPACITY = 500;

export type WarehouseEntryType = (typeof WAREHOUSE_ENTRY_TYPES)[number];

export const DEFAULT_WAREHOUSE_STARTER_ENTRIES: Array<{
  entryType: WarehouseEntryType;
  itemId?: string;
  skillId?: string;
  quantity: number;
  remainingUses?: number | null;
  durabilityCurrent?: number | null;
  durabilityMax?: number | null;
  isEquipped?: boolean;
  equippedSlot?: string;
  affixConfig?: ItemAffix[];
}> = [];

function clampNumber(value: number, min: number, max: number, fallback: number) {
  const normalized = Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, normalized));
}

export function clampWarehouseCapacity(value: number) {
  return Math.round(
    clampNumber(
      Number(value ?? DEFAULT_WAREHOUSE_CAPACITY),
      DEFAULT_WAREHOUSE_CAPACITY,
      MAX_WAREHOUSE_CAPACITY,
      DEFAULT_WAREHOUSE_CAPACITY,
    ),
  );
}

export function clampWarehouseExpandAmount(value: number) {
  return Math.round(
    clampNumber(Number(value ?? DEFAULT_WAREHOUSE_EXPAND_AMOUNT), 1, 100, DEFAULT_WAREHOUSE_EXPAND_AMOUNT),
  );
}

export function clampWarehouseQuantity(value: number) {
  return Math.round(clampNumber(Number(value ?? 1), 1, 999, 1));
}
