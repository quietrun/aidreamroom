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
}> = [
  {
    entryType: 'item',
    itemId: 'item_giant_blood_tonic',
    quantity: 2,
    remainingUses: 1,
  },
  {
    entryType: 'item',
    itemId: 'item_starlight_inhaler',
    quantity: 1,
    remainingUses: 3,
  },
  {
    entryType: 'item',
    itemId: 'item_hunter_rifle',
    quantity: 1,
    durabilityCurrent: 104,
    durabilityMax: 120,
  },
  {
    entryType: 'item',
    itemId: 'item_phase_boots',
    quantity: 1,
    isEquipped: true,
    equippedSlot: 'shoes',
    affixConfig: [
      {
        name: '疾步',
        modifiers: [
          {
            targetType: 'derived',
            key: 'moveRate',
            value: 1,
            label: '移动速率 +1',
          },
        ],
      },
    ],
  },
  {
    entryType: 'item',
    itemId: 'item_elder_amulet',
    quantity: 1,
    equippedSlot: 'accessory',
  },
  {
    entryType: 'skill_card',
    skillId: 'skill_contract_call',
    quantity: 1,
  },
];

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
