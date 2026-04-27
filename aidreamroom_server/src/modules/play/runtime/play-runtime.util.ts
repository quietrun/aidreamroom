import {
  NarrationOutput,
  ParsedIntent,
  PlayCharacterProfile,
  PlayClientSnapshot,
  PlayEventType,
  PlayGameEvent,
  PlayGameState,
  PlayMessageRecord,
  PlayerInputAnalysis,
  PlayRollResult,
  PlayScriptBundle,
  PlayScriptRecord,
  RawCondition,
  RawItemFile,
  RawLocation,
  RawLocationConnection,
  RawMapFile,
  RawNpcFile,
  RawOutcome,
  RawScriptFile,
  RawScriptNode,
  RuleActionResult,
  RuleResult,
  ValueMap,
} from './play-runtime.types';
import {
  applyEventRuleResult,
  buildEventClientSnapshot,
  buildEventOpeningFallbackMessages,
  buildEventOpeningPrompt,
  buildEventNarrationPrompt,
  buildEventWelcomeMessages,
  createInitialEventGameState,
  executeEventRule,
  isEventDrivenBundle,
} from './play-runtime.event.util';
import {
  stringifyPromptPayload,
  summarizeRecentEvents,
  summarizeRecentMessages,
  summarizeRuleResultForPrompt,
  trimPromptText,
} from './play-runtime.prompt.util';

const MOVE_KEYWORDS = ['去', '前往', '移动', '走', '进入', '前进', '离开', '到'];
const TALK_KEYWORDS = ['问', '询问', '交谈', '聊天', '搭话', '告诉', '说', '问问'];
const INSPECT_KEYWORDS = ['观察', '检查', '调查', '搜索', '摸索', '翻找', '查看', '看一下', '看一眼', '环顾', '打量'];
const USE_KEYWORDS = ['用', '使用', '打开', '解锁', '启动', '拿出', '掏出'];
const QUESTION_KEYWORDS = ['吗', '？', '?', '哪里', '谁', '什么', '怎么', '为何', '为什么'];
const ROLL_TYPE_LABELS: Record<string, string> = {
  perception: '侦查',
  charisma: '魅力',
  luck: '幸运',
  strength: '力量',
  constitution: '体质',
  size: '体型',
  dexterity: '敏捷',
  appearance: '外貌',
  intelligence: '智力',
  power: '意志',
  education: '教育',
  none: '无',
};

const DIFFICULTY_RATE: Record<string, number> = {
  easy: 1,
  normal: 0.8,
  medium: 0.8,
  hard: 0.6,
  extreme: 0.4,
  critical: 0.2,
  none: 1,
};

function safeParseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s\r\n\t`~!@#$%^&*()_\-+=[\]{}\\|;:'"，。、《》？?！、：]/g, '');
}

function buildAliasLookup(
  entries: Array<{ id: string; names: string[] }>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of entries) {
    for (const name of entry.names) {
      const normalized = normalizeText(name);
      if (normalized) {
        result[normalized] = entry.id;
      }
    }
  }
  return result;
}

function findLongestAlias(
  input: string,
  aliases: Record<string, string>,
): string | undefined {
  const normalizedInput = normalizeText(input);
  let matchedAlias = '';
  let matchedId = '';

  for (const [alias, id] of Object.entries(aliases)) {
    if (!alias || !normalizedInput.includes(alias)) {
      continue;
    }
    if (alias.length > matchedAlias.length) {
      matchedAlias = alias;
      matchedId = id;
    }
  }

  return matchedId || undefined;
}

function isEmptyObject(value: unknown) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0;
}

function normalizeInlineText(value: string) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function compareValue(actual: unknown, operator: string, expected: unknown) {
  switch (operator) {
    case 'exists':
      return actual !== undefined && actual !== null && actual !== false && actual !== '';
    case 'not_exists':
      return actual === undefined || actual === null || actual === false || actual === '';
    case '>=':
      return Number(actual ?? 0) >= Number(expected ?? 0);
    case '<=':
      return Number(actual ?? 0) <= Number(expected ?? 0);
    case '>':
      return Number(actual ?? 0) > Number(expected ?? 0);
    case '<':
      return Number(actual ?? 0) < Number(expected ?? 0);
    case '==':
    default:
      return String(actual ?? '') === String(expected ?? '');
  }
}

function getRollTypeLabel(type: string) {
  return ROLL_TYPE_LABELS[String(type ?? '').toLowerCase()] ?? String(type ?? '');
}

function localizeSummaryText(text: string) {
  return String(text ?? '').replace(
    /\b(perception|charisma|luck|strength|constitution|size|dexterity|appearance|intelligence|power|education|none)\b\s*检定/gi,
    (match) => `${getRollTypeLabel(match.replace(/\s*检定$/i, ''))}检定`,
  );
}

function hasAnyKeyword(input: string, keywords: string[]) {
  return keywords.some((keyword) => input.includes(keyword));
}

export function getCurrentNode(bundle: PlayScriptBundle, state: PlayGameState) {
  return (
    bundle.nodesById[state.currentNodeId] ??
    bundle.scriptFile.nodes?.[0] ??
    ({
      node_id: '',
      title: '未知节点',
      location_id: state.currentLocationId,
      description: '',
    } as RawScriptNode)
  );
}

export function getCurrentLocation(bundle: PlayScriptBundle, state: PlayGameState) {
  return (
    bundle.locationsById[state.currentLocationId] ??
    (getCurrentNode(bundle, state).location_id
      ? bundle.locationsById[String(getCurrentNode(bundle, state).location_id)]
      : undefined) ??
    bundle.map.locations?.[0] ??
    ({
      location_id: '',
      name: '未知地点',
      description: '',
      connections: [],
      items: [],
      npcs: [],
    } as RawLocation)
  );
}

export function getLocationPrimaryNode(bundle: PlayScriptBundle, locationId: string) {
  const node = bundle.nodesByLocationId[locationId]?.[0];
  if (node) {
    return node;
  }

  return bundle.scriptFile.nodes?.[0];
}

export function getDisplayItemName(bundle: PlayScriptBundle, itemId: string) {
  return bundle.itemsById[itemId]?.name ?? itemId;
}

export function getDisplayNpcName(bundle: PlayScriptBundle, npcId: string) {
  return bundle.npcsById[npcId]?.name ?? npcId;
}

function getInventoryCount(inventory: Record<string, number>, itemId: string) {
  return Math.max(0, Number(inventory[itemId] ?? 0));
}

function isItemStackable(bundle: PlayScriptBundle, itemId: string) {
  return bundle.itemsById[itemId]?.stackable !== false;
}

function addInventoryItem(
  inventory: Record<string, number>,
  bundle: PlayScriptBundle,
  itemId: string,
  count = 1,
) {
  const normalizedItemId = String(itemId ?? '').trim();
  const normalizedCount = Math.max(0, Math.trunc(Number(count ?? 0)));
  if (!normalizedItemId || normalizedCount <= 0) {
    return 0;
  }

  const currentCount = getInventoryCount(inventory, normalizedItemId);
  if (!isItemStackable(bundle, normalizedItemId)) {
    if (currentCount > 0) {
      return 0;
    }
    inventory[normalizedItemId] = 1;
    return 1;
  }

  inventory[normalizedItemId] = currentCount + normalizedCount;
  return normalizedCount;
}

function removeInventoryItem(
  inventory: Record<string, number>,
  itemId: string,
  count = 1,
) {
  const normalizedItemId = String(itemId ?? '').trim();
  const normalizedCount = Math.max(0, Math.trunc(Number(count ?? 0)));
  if (!normalizedItemId || normalizedCount <= 0) {
    return 0;
  }

  const currentCount = getInventoryCount(inventory, normalizedItemId);
  if (currentCount <= 0) {
    return 0;
  }

  const removedCount = Math.min(currentCount, normalizedCount);
  const nextCount = currentCount - removedCount;
  if (nextCount > 0) {
    inventory[normalizedItemId] = nextCount;
  } else {
    delete inventory[normalizedItemId];
  }

  return removedCount;
}

function normalizeInventory(
  inventory: Record<string, number>,
  bundle: PlayScriptBundle,
) {
  for (const [itemId, rawCount] of Object.entries({ ...inventory })) {
    const count = Math.max(0, Math.trunc(Number(rawCount ?? 0)));
    if (count <= 0) {
      delete inventory[itemId];
      continue;
    }

    inventory[itemId] = isItemStackable(bundle, itemId) ? count : 1;
  }

  return inventory;
}

export function evaluateCondition(
  condition: RawCondition | undefined,
  state: PlayGameState,
  character: PlayCharacterProfile,
  rollSuccess?: boolean,
) {
  if (!condition || isEmptyObject(condition)) {
    return true;
  }

  const operator = String(condition.operator ?? '==');
  const type = String(condition.type ?? '').toLowerCase();
  const name = String(condition.name ?? '');
  let actual: unknown;

  switch (type) {
    case 'item':
      actual = state.inventory[name] ?? 0;
      break;
    case 'flag':
      actual = state.flags[name];
      break;
    case 'attribute':
      actual = character.metrics[name] ?? character.info[name];
      break;
    case 'roll_result':
      actual = rollSuccess ? 'success' : 'failure';
      break;
    default:
      actual = state.flags[name];
      break;
  }

  return compareValue(actual, operator, condition.value);
}

export function evaluateConditions(
  conditions: RawCondition[] | undefined,
  state: PlayGameState,
  character: PlayCharacterProfile,
  rollSuccess?: boolean,
) {
  return (conditions ?? []).every((condition) =>
    evaluateCondition(condition, state, character, rollSuccess),
  );
}

export function connectionFlagKey(fromLocationId: string, toLocationId: string) {
  return `connection_unlocked:${fromLocationId}:${toLocationId}`;
}

export function isConnectionLocked(
  connection: RawLocationConnection,
  currentLocationId: string,
  state: PlayGameState,
  character: PlayCharacterProfile,
) {
  if (!connection.locked) {
    return false;
  }

  const unlockedByFlag = Boolean(state.flags[connectionFlagKey(currentLocationId, connection.target_location_id)]);
  if (unlockedByFlag) {
    return false;
  }

  return !evaluateCondition(connection.lock_condition, state, character);
}

export function listAvailableConnections(
  bundle: PlayScriptBundle,
  state: PlayGameState,
  character: PlayCharacterProfile,
) {
  const location = getCurrentLocation(bundle, state);
  return (location.connections ?? []).filter(
    (connection) => !isConnectionLocked(connection, location.location_id, state, character),
  );
}

export function performRoll(
  currentNode: RawScriptNode,
  character: PlayCharacterProfile,
): PlayRollResult | undefined {
  if (!currentNode.roll_required) {
    return undefined;
  }

  const type = String(currentNode.roll_type ?? 'luck');
  const difficulty = String(currentNode.roll_difficulty ?? 'normal').toLowerCase();
  const rate = DIFFICULTY_RATE[difficulty] ?? DIFFICULTY_RATE.normal;
  const baseValue = Number(character.metrics[type] ?? character.info[type] ?? 50);
  const targetData = Math.max(1, Math.floor(baseValue * rate));
  const rollData = Math.floor(Math.random() * 100) + 1;

  return {
    type,
    difficulty,
    rollData,
    targetData,
    success: rollData <= targetData,
  };
}

export function parseScriptBundle(record: PlayScriptRecord): PlayScriptBundle {
  const map = safeParseJson<RawMapFile>(record.mapFile, { locations: [] });
  const npcFile = safeParseJson<RawNpcFile>(record.npcFile, { characters: [] });
  const itemFile = safeParseJson<RawItemFile>(record.itemFile, { objects: [] });
  const scriptFile = safeParseJson<RawScriptFile>(record.scriptFile, {
    metadata: {},
    nodes: [],
    events: [],
  });

  const locationsById = Object.fromEntries(
    (map.locations ?? []).map((location) => [location.location_id, location]),
  );
  const nodesById = Object.fromEntries(
    (scriptFile.nodes ?? []).map((node) => [node.node_id, node]),
  );
  const npcsById = Object.fromEntries(
    (npcFile.characters ?? []).map((npc) => [npc.npc_id, npc]),
  );
  const itemsById = Object.fromEntries(
    (itemFile.objects ?? []).map((item) => [item.item_id, item]),
  );
  const eventsById = Object.fromEntries(
    (scriptFile.events ?? []).map((event) => [event.event_id, event]),
  );

  const nodesByLocationId: Record<string, RawScriptNode[]> = {};
  for (const node of scriptFile.nodes ?? []) {
    const locationId = String(node.location_id ?? '');
    if (!locationId) {
      continue;
    }
    nodesByLocationId[locationId] = nodesByLocationId[locationId] ?? [];
    nodesByLocationId[locationId].push(node);
  }

  const eventsByLocationId: PlayScriptBundle['eventsByLocationId'] = {};
  const globalEvents = [] as PlayScriptBundle['globalEvents'];
  for (const event of scriptFile.events ?? []) {
    const bindingLocationIds = [
      event.location_binding?.location_id ?? undefined,
      ...(event.location_binding?.location_ids ?? []),
    ]
      .map((item) => String(item ?? '').trim())
      .filter(Boolean);

    if (bindingLocationIds.length === 0 || String(event.location_binding?.scope ?? '').toLowerCase() === 'global') {
      globalEvents.push(event);
    }

    for (const locationId of bindingLocationIds) {
      eventsByLocationId[locationId] = eventsByLocationId[locationId] ?? [];
      eventsByLocationId[locationId].push(event);
    }
  }

  const connectionsById = Object.fromEntries(
    (map.locations ?? [])
      .flatMap((location) => location.connections ?? [])
      .map((connection) => [String(connection.connection_id ?? ''), connection])
      .filter(([connectionId]) => Boolean(connectionId)),
  );

  const locationAliases = buildAliasLookup(
    (map.locations ?? []).map((location) => ({
      id: location.location_id,
      names: [location.location_id, location.name],
    })),
  );
  const npcAliases = buildAliasLookup(
    (npcFile.characters ?? []).map((npc) => ({
      id: npc.npc_id,
      names: [npc.npc_id, npc.name],
    })),
  );
  const itemAliases = buildAliasLookup(
    (itemFile.objects ?? []).map((item) => ({
      id: item.item_id,
      names: [item.item_id, item.name],
    })),
  );

  return {
    scriptId: record.uuid,
    mode: (scriptFile.events ?? []).length > 0 ? 'event' : 'legacy_node',
    initialEventId: String(scriptFile.metadata?.initial_event_id ?? '').trim() || undefined,
    map,
    npcFile,
    itemFile,
    scriptFile,
    locationsById,
    nodesById,
    nodesByLocationId,
    eventsById,
    eventsByLocationId,
    globalEvents,
    connectionsById,
    npcsById,
    itemsById,
    locationAliases,
    npcAliases,
    itemAliases,
  };
}

export function extractKnownInventory(
  bundle: PlayScriptBundle,
  loadoutLabels: string[],
) {
  const inventory: Record<string, number> = {};
  for (const label of loadoutLabels) {
    const normalized = normalizeText(label.replace(/^[^:：]+[:：]/, ''));
    for (const [itemId, item] of Object.entries(bundle.itemsById)) {
      if (!normalized.includes(normalizeText(item.name))) {
        continue;
      }
      addInventoryItem(inventory, bundle, itemId);
    }
  }
  return inventory;
}

export function createInitialGameState(
  sessionId: string,
  bundle: PlayScriptBundle,
  loadoutLabels: string[] = [],
): PlayGameState {
  if (isEventDrivenBundle(bundle)) {
    return createInitialEventGameState(sessionId, bundle, loadoutLabels);
  }

  const startLocationId =
    bundle.map.start_location_id ??
    bundle.map.locations?.[0]?.location_id ??
    '';
  const startNode =
    getLocationPrimaryNode(bundle, startLocationId) ??
    bundle.scriptFile.nodes?.[0] ?? {
      node_id: '',
      title: '起点',
      location_id: startLocationId,
      description: '',
    };
  const inventory = extractKnownInventory(bundle, loadoutLabels);
  const currentObjectives = [
    bundle.scriptFile.metadata?.description,
    ...(bundle.scriptFile.metadata?.required_knowledge ?? []),
    ...((bundle.scriptFile.metadata?.required_items ?? []).map(
      (itemId) => `获得 ${getDisplayItemName(bundle, itemId)}`,
    )),
    `探索 ${bundle.locationsById[startLocationId]?.name ?? startLocationId}`,
  ]
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    sessionId,
    scriptId: bundle.scriptId,
    currentNodeId: startNode.node_id,
    currentEventId: undefined,
    currentLocationId: String(startNode.location_id ?? startLocationId),
    visitedNodeIds: startNode.node_id ? [startNode.node_id] : [],
    visitedLocationIds: startLocationId ? [startLocationId] : [],
    discoveredLocationIds: startLocationId ? [startLocationId] : [],
    unlockedLocationIds: startLocationId ? [startLocationId] : [],
    unlockedConnectionIds: [],
    blockedConnectionIds: [],
    completedEventIds: [],
    knowledge: [],
    attributes: {},
    worldState: {},
    timeUnit: 'turn',
    timeValue: 0,
    inventory,
    loadoutLabels,
    flags: {},
    npcStates: {},
    recentEvents: [],
    narrativeSummary: `你已进入 ${bundle.locationsById[startLocationId]?.name ?? '未知地点'}。`,
    currentObjectives,
    turnCount: 0,
    status: 'active',
    updatedAt: Date.now(),
  };
}

export function parseIntent(
  playerInput: string,
  bundle: PlayScriptBundle,
  inputMode: 'action' | 'dialogue' | 'thought' = 'action',
  state?: PlayGameState,
): ParsedIntent {
  const targetLocationId = findLongestAlias(playerInput, bundle.locationAliases);
  const targetNpcId = findLongestAlias(playerInput, bundle.npcAliases);
  const targetItemId = findLongestAlias(playerInput, bundle.itemAliases);
  const currentLocationNpcIds = state
    ? getCurrentLocation(bundle, state).npcs ?? []
    : [];

  if (inputMode === 'thought') {
    if (hasAnyKeyword(playerInput, INSPECT_KEYWORDS)) {
      return {
        intent: 'inspect',
        targetItemId,
        targetNpcId,
        targetLocationId,
        confidence: 0.8,
        rawText: playerInput,
      };
    }

    if (hasAnyKeyword(playerInput, QUESTION_KEYWORDS) || targetNpcId) {
      return {
        intent: 'ask_world_question',
        targetNpcId,
        confidence: 0.76,
        rawText: playerInput,
      };
    }

    return {
      intent: 'free_roleplay',
      confidence: 0.68,
      rawText: playerInput,
    };
  }

  if (inputMode === 'dialogue') {
    const resolvedNpcId =
      targetNpcId ||
      (currentLocationNpcIds.length === 1 ? currentLocationNpcIds[0] : undefined);
    if (resolvedNpcId) {
      return {
        intent: 'talk_to_npc',
        targetNpcId: resolvedNpcId,
        confidence: 0.97,
        rawText: playerInput,
      };
    }

    return {
      intent: hasAnyKeyword(playerInput, QUESTION_KEYWORDS) ? 'ask_world_question' : 'free_roleplay',
      confidence: 0.72,
      rawText: playerInput,
    };
  }

  if (targetLocationId && hasAnyKeyword(playerInput, MOVE_KEYWORDS)) {
    return {
      intent: 'move',
      targetLocationId,
      confidence: 0.96,
      rawText: playerInput,
    };
  }

  if (targetNpcId && (hasAnyKeyword(playerInput, TALK_KEYWORDS) || hasAnyKeyword(playerInput, QUESTION_KEYWORDS))) {
    return {
      intent: 'talk_to_npc',
      targetNpcId,
      confidence: 0.94,
      rawText: playerInput,
    };
  }

  if (targetItemId && hasAnyKeyword(playerInput, USE_KEYWORDS)) {
    return {
      intent: 'use_item',
      targetItemId,
      confidence: 0.95,
      rawText: playerInput,
    };
  }

  if (hasAnyKeyword(playerInput, INSPECT_KEYWORDS)) {
    return {
      intent: 'inspect',
      targetItemId,
      targetNpcId,
      targetLocationId,
      confidence: 0.82,
      rawText: playerInput,
    };
  }

  if (targetNpcId) {
    return {
      intent: 'talk_to_npc',
      targetNpcId,
      confidence: 0.74,
      rawText: playerInput,
    };
  }

  if (targetLocationId) {
    return {
      intent: 'move',
      targetLocationId,
      confidence: 0.72,
      rawText: playerInput,
    };
  }

  if (targetItemId) {
    return {
      intent: 'use_item',
      targetItemId,
      confidence: 0.7,
      rawText: playerInput,
    };
  }

  if (hasAnyKeyword(playerInput, QUESTION_KEYWORDS)) {
    return {
      intent: 'ask_world_question',
      confidence: 0.62,
      rawText: playerInput,
    };
  }

  return {
    intent: 'free_roleplay',
    confidence: 0.5,
    rawText: playerInput,
  };
}

export function analyzePlayerInput(
  playerInput: string,
  bundle: PlayScriptBundle,
  preferredMode: 'action' | 'dialogue' | 'thought' = 'action',
  state?: PlayGameState,
): PlayerInputAnalysis {
  const raw = normalizeInlineText(playerInput);
  const currentLocationNpcIds = state
    ? getCurrentLocation(bundle, state).npcs ?? []
    : [];
  const explicitNpcId = findLongestAlias(raw, bundle.npcAliases);
  const targetNpcId =
    preferredMode === 'dialogue'
      ? explicitNpcId || (currentLocationNpcIds.length === 1 ? currentLocationNpcIds[0] : undefined)
      : undefined;

  if (preferredMode === 'dialogue') {
    return {
      mode: 'dialogue',
      spokenText: raw,
      addresseeNpcId: targetNpcId,
    };
  }

  if (preferredMode === 'thought') {
    return {
      mode: 'thought',
      thoughtText: raw,
      addresseeNpcId: targetNpcId,
    };
  }

  return {
    mode: 'action',
    actionText: raw,
  };
}

function summarizeOutcome(outcome: RawOutcome) {
  return String(outcome.description ?? '').trim();
}

function getNodeStage(currentNode: RawScriptNode) {
  const title = String(currentNode.title ?? '');
  const stage = title.split('：').at(-1)?.trim() ?? title.trim();
  switch (stage) {
    case '初探':
      return 'intro';
    case '异响':
      return 'noise';
    case '交涉':
      return 'dialogue';
    case '搜寻':
      return 'search';
    case '抉择':
      return 'decision';
    default:
      return 'unknown';
  }
}

function shouldApplyNodeOutcome(currentNode: RawScriptNode, intent: ParsedIntent) {
  const stage = getNodeStage(currentNode);

  switch (intent.intent) {
    case 'move':
      return false;
    case 'talk_to_npc':
      return stage === 'dialogue';
    case 'ask_world_question':
      return false;
    case 'free_roleplay':
      return false;
    case 'inspect':
      return stage === 'intro' || stage === 'noise' || stage === 'search';
    case 'use_item':
      return stage !== 'dialogue';
    default:
      return stage === 'intro' || stage === 'noise' || stage === 'search';
  }
}

function scoreOutcomeMatch(
  input: string,
  outcome: RawOutcome,
  intent: ParsedIntent,
  bundle: PlayScriptBundle,
) {
  let score = 0;
  const description = String(outcome.description ?? '');
  const normalizedInput = normalizeText(input);

  if (intent.targetLocationId && outcome.target_location_id === intent.targetLocationId) {
    score += 10;
  }
  if (intent.targetNodeId && outcome.next_node === intent.targetNodeId) {
    score += 10;
  }
  if (intent.targetNpcId && (outcome.npcs_encountered ?? []).includes(intent.targetNpcId)) {
    score += 8;
  }
  if (intent.targetItemId && (outcome.items_gained ?? []).includes(intent.targetItemId)) {
    score += 8;
  }

  if (description) {
    const normalizedDescription = normalizeText(description);
    if (normalizedDescription && normalizedInput.includes(normalizedDescription)) {
      score += 6;
    }

    const relatedNames = [
      intent.targetLocationId
        ? bundle.locationsById[intent.targetLocationId]?.name
        : '',
      intent.targetNpcId ? bundle.npcsById[intent.targetNpcId]?.name : '',
      intent.targetItemId ? bundle.itemsById[intent.targetItemId]?.name : '',
    ].filter(Boolean);

    if (relatedNames.some((name) => description.includes(String(name)))) {
      score += 4;
    }
  }

  return score;
}

function buildObjectives(
  bundle: PlayScriptBundle,
  state: PlayGameState,
) {
  const currentNode = getCurrentNode(bundle, state);
  const availableMoves = listAvailableConnections(
    bundle,
    state,
    {
      id: '',
      name: '',
      image: '',
      info: {},
      metrics: {},
    },
  )
    .map((connection) => bundle.locationsById[connection.target_location_id]?.name)
    .filter(Boolean)
    .slice(0, 3) as string[];

  const objectives = [
    ...state.currentObjectives,
    ...(bundle.scriptFile.metadata?.required_knowledge ?? []),
    ...((bundle.scriptFile.metadata?.required_items ?? []).map(
      (itemId) => `获得 ${getDisplayItemName(bundle, itemId)}`,
    )),
    summarizeOutcome((currentNode.outcomes ?? [])[0] ?? {}),
    ...availableMoves.map((name) => `前往 ${name}`),
  ]
    .map((item) => String(item).trim())
    .filter(Boolean);

  return [...new Set(objectives)].slice(0, 6);
}

function buildActionResult(
  type: RuleActionResult['type'],
  success: boolean,
  summary: string,
  extra: Partial<RuleActionResult> = {},
): RuleActionResult {
  return {
    type,
    success,
    summary,
    ...extra,
  };
}

function matchOutcome(
  input: string,
  currentNode: RawScriptNode,
  state: PlayGameState,
  character: PlayCharacterProfile,
  intent: ParsedIntent,
  bundle: PlayScriptBundle,
) {
  const roll = performRoll(currentNode, character);
  let candidates = (currentNode.outcomes ?? []).filter((outcome) => {
    const outcomeCondition = outcome.condition;
    if (!outcomeCondition || isEmptyObject(outcomeCondition)) {
      return true;
    }

    const clonedCondition = { ...outcomeCondition };
    delete clonedCondition.roll_success;
    delete clonedCondition.is_ending;
    delete clonedCondition.ending_type;
    delete clonedCondition.ending_title;

    return evaluateCondition(clonedCondition, state, character, roll?.success);
  });

  if (roll && candidates.some((outcome) => typeof outcome.condition?.roll_success === 'boolean')) {
    candidates = candidates.filter((outcome) => {
      if (typeof outcome.condition?.roll_success !== 'boolean') {
        return true;
      }
      return outcome.condition.roll_success === roll.success;
    });
  }

  let bestOutcome: RawOutcome | undefined;
  let bestScore = -1;

  for (const outcome of candidates) {
    const score = scoreOutcomeMatch(input, outcome, intent, bundle);
    if (score > bestScore) {
      bestScore = score;
      bestOutcome = outcome;
    }
  }

  if (!bestOutcome && candidates.length === 1) {
    bestOutcome = candidates[0];
  }

  return { outcome: bestOutcome, roll };
}

function applyOutcomeToResult(
  result: RuleResult,
  outcome: RawOutcome | undefined,
  state: PlayGameState,
  bundle: PlayScriptBundle,
  currentNode: RawScriptNode,
  currentLocation: RawLocation,
) {
  if (!outcome) {
    return result;
  }

  const inventoryAdd: Record<string, number> = {};
  const projectedInventory = { ...state.inventory };
  for (const itemId of outcome.items_gained ?? []) {
    const addedCount = addInventoryItem(projectedInventory, bundle, itemId);
    if (addedCount > 0) {
      inventoryAdd[itemId] = (inventoryAdd[itemId] ?? 0) + addedCount;
    }
  }
  const nextNode =
    outcome.next_node && outcome.next_node !== 'node_end'
      ? bundle.nodesById[outcome.next_node]
      : undefined;
  const nextLocationId =
    outcome.target_location_id ??
    nextNode?.location_id ??
    currentLocation.location_id;
  const encounteredNpcIds = (outcome.npcs_encountered ?? []).filter((npcId) => {
    if (!npcId || nextLocationId === currentLocation.location_id) {
      return Boolean(npcId);
    }
    return (bundle.locationsById[nextLocationId]?.npcs ?? []).includes(npcId);
  });

  const npcStates: PlayGameState['npcStates'] = {};
  for (const npcId of encounteredNpcIds) {
    npcStates[npcId] = {
      met: true,
      hostility: bundle.npcsById[npcId]?.hostility ?? 'neutral',
    };
  }

  const status =
    outcome.condition?.is_ending || outcome.next_node === 'node_end'
      ? 'finished'
      : undefined;

  const ending =
    outcome.condition?.is_ending
      ? {
          type: String(outcome.condition.ending_type ?? 'ending'),
          title: String(
            outcome.condition.ending_title ??
              outcome.description ??
              '旅程结束',
          ),
        }
      : undefined;

  result.stateChanges = {
    ...result.stateChanges,
    currentNodeId: nextNode?.node_id ?? result.stateChanges.currentNodeId,
    currentLocationId: nextLocationId,
    inventoryAdd:
      Object.keys(inventoryAdd).length > 0 ? inventoryAdd : result.stateChanges.inventoryAdd,
    npcStates:
      Object.keys(npcStates).length > 0 ? npcStates : result.stateChanges.npcStates,
    status,
  };

  result.triggeredNodeId = nextNode?.node_id ?? currentNode.node_id;
  result.triggeredLocationId = nextLocationId;
  result.triggeredOutcomeDescription = outcome.description;
  result.ending = ending;

  if (nextLocationId && nextLocationId !== currentLocation.location_id) {
    result.actionResults.push(
      buildActionResult(
        'move',
        true,
        `抵达 ${bundle.locationsById[nextLocationId]?.name ?? nextLocationId}`,
        {
          locationId: nextLocationId,
          nodeId: nextNode?.node_id,
        },
      ),
    );
  }

  for (const itemId of Object.keys(inventoryAdd)) {
    result.actionResults.push(
      buildActionResult('item_gain', true, `获得 ${getDisplayItemName(bundle, itemId)}`, {
        itemId,
      }),
    );
  }

  for (const npcId of encounteredNpcIds) {
    result.actionResults.push(
      buildActionResult('dialogue', true, `遭遇 ${getDisplayNpcName(bundle, npcId)}`, {
        npcId,
      }),
    );
  }
}

export function buildAllowedNextNodes(
  bundle: PlayScriptBundle,
  state: PlayGameState,
  character: PlayCharacterProfile,
) {
  const currentNode = getCurrentNode(bundle, state);
  const nodeBased = (currentNode.outcomes ?? [])
    .filter((outcome) => {
      if (!outcome.next_node || outcome.next_node === 'node_end') {
        return false;
      }

      const condition = outcome.condition;
      if (!condition || isEmptyObject(condition)) {
        return true;
      }

      const clonedCondition = { ...condition };
      delete clonedCondition.roll_success;
      delete clonedCondition.is_ending;
      delete clonedCondition.ending_type;
      delete clonedCondition.ending_title;
      return evaluateCondition(clonedCondition, state, character);
    })
    .map((outcome) => ({
      id: String(outcome.next_node ?? ''),
      trigger: String(outcome.description ?? '推进剧情'),
    }));

  const moveBased = listAvailableConnections(bundle, state, character).map((connection) => {
    const targetNode = getLocationPrimaryNode(bundle, connection.target_location_id);
    return {
      id: targetNode?.node_id ?? connection.target_location_id,
      trigger: `前往 ${bundle.locationsById[connection.target_location_id]?.name ?? connection.target_location_id}`,
    };
  });

  const merged = [...nodeBased, ...moveBased];
  const seen = new Set<string>();
  return merged.filter((item) => {
    if (!item.id || seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

function hasInventoryItem(state: PlayGameState, itemId: string) {
  return Number(state.inventory[itemId] ?? 0) > 0;
}

function loadoutContainsLabel(state: PlayGameState, bundle: PlayScriptBundle, itemId: string) {
  const itemName = bundle.itemsById[itemId]?.name;
  if (!itemName) {
    return false;
  }

  return state.loadoutLabels.some((label) => label.includes(itemName));
}

export function executeRule(
  playerInput: string,
  intent: ParsedIntent,
  state: PlayGameState,
  bundle: PlayScriptBundle,
  character: PlayCharacterProfile,
): RuleResult {
  if (isEventDrivenBundle(bundle)) {
    return executeEventRule(playerInput, intent, state, bundle, character);
  }

  const currentNode = getCurrentNode(bundle, state);
  const currentLocation = getCurrentLocation(bundle, state);
  const presentNpcIds = [...new Set(currentLocation.npcs ?? [])];
  const availableConnections = listAvailableConnections(bundle, state, character);
  const baseResult: RuleResult = {
    success: true,
    actionType: intent.intent,
    actionResults: [],
    stateChanges: {},
    allowedNextNodes: [],
  };

  const shouldApplyOutcome = shouldApplyNodeOutcome(currentNode, intent);
  const { outcome, roll } = shouldApplyOutcome
    ? matchOutcome(
        playerInput,
        currentNode,
        state,
        character,
        intent,
        bundle,
      )
    : { outcome: undefined, roll: undefined };

  if (roll) {
    baseResult.roll = roll;
    baseResult.actionResults.push(
      buildActionResult(
        'roll',
        roll.success,
        `${getRollTypeLabel(roll.type)}检定 ${roll.success ? '成功' : '失败'}（${roll.rollData}/${roll.targetData}）`,
      ),
    );
  }

  switch (intent.intent) {
    case 'move': {
      const targetLocationId = intent.targetLocationId;
      if (!targetLocationId) {
        baseResult.success = false;
        baseResult.reason = '未识别出明确目的地';
        baseResult.actionResults.push(
          buildActionResult('move', false, '你还没有明确要前往哪里。'),
        );
        break;
      }

      const connection = availableConnections.find(
        (item) => item.target_location_id === targetLocationId,
      );
      if (!connection) {
        baseResult.success = false;
        baseResult.reason = '目标地点当前不可达';
        baseResult.actionResults.push(
          buildActionResult(
            'move',
            false,
            `${bundle.locationsById[targetLocationId]?.name ?? targetLocationId} 当前无法抵达。`,
          ),
        );
        break;
      }

      const nextNode = getLocationPrimaryNode(bundle, targetLocationId);
      baseResult.stateChanges.currentLocationId = targetLocationId;
      if (nextNode?.node_id) {
        baseResult.stateChanges.currentNodeId = nextNode.node_id;
      }
      baseResult.actionResults.push(
        buildActionResult(
          'move',
          true,
          `前往 ${bundle.locationsById[targetLocationId]?.name ?? targetLocationId}`,
          {
            locationId: targetLocationId,
            nodeId: nextNode?.node_id,
          },
        ),
      );
      applyOutcomeToResult(baseResult, outcome, state, bundle, currentNode, currentLocation);
      break;
    }
    case 'talk_to_npc': {
      const targetNpcId = intent.targetNpcId;
      if (!targetNpcId || !presentNpcIds.includes(targetNpcId)) {
        baseResult.success = false;
        baseResult.reason = 'NPC 不在当前场景';
        baseResult.actionResults.push(
          buildActionResult('dialogue', false, '当前没有可对话的对象回应你。'),
        );
        break;
      }

      baseResult.stateChanges.npcStates = {
        [targetNpcId]: {
          met: true,
          hostility: bundle.npcsById[targetNpcId]?.hostility ?? 'neutral',
          lastTopic: playerInput,
        },
      };
      baseResult.actionResults.push(
        buildActionResult(
          'dialogue',
          true,
          `你试图与 ${getDisplayNpcName(bundle, targetNpcId)} 交谈。`,
          { npcId: targetNpcId },
        ),
      );
      applyOutcomeToResult(baseResult, outcome, state, bundle, currentNode, currentLocation);
      break;
    }
    case 'use_item': {
      const targetItemId = intent.targetItemId;
      if (
        !targetItemId ||
        (!hasInventoryItem(state, targetItemId) &&
          !loadoutContainsLabel(state, bundle, targetItemId))
      ) {
        baseResult.success = false;
        baseResult.reason = '缺少目标物品';
        baseResult.actionResults.push(
          buildActionResult('use_item', false, '你手上没有可以这样使用的物品。'),
        );
        break;
      }

      const lockedConnections = (currentLocation.connections ?? []).filter((connection) => {
        if (!connection.locked) {
          return false;
        }
        return connection.lock_condition?.type === 'item' && connection.lock_condition.name === targetItemId;
      });

      if (lockedConnections.length > 0) {
        const flagUpdates: ValueMap = {};
        for (const connection of lockedConnections) {
          flagUpdates[connectionFlagKey(currentLocation.location_id, connection.target_location_id)] = true;
        }
        baseResult.stateChanges.flags = flagUpdates;
        baseResult.actionResults.push(
          buildActionResult(
            'use_item',
            true,
            `你用 ${getDisplayItemName(bundle, targetItemId)} 解开了阻碍。`,
            { itemId: targetItemId },
          ),
        );
      } else {
        baseResult.actionResults.push(
          buildActionResult(
            'use_item',
            true,
            `你使用了 ${getDisplayItemName(bundle, targetItemId)}。`,
            { itemId: targetItemId },
          ),
        );
      }

      applyOutcomeToResult(baseResult, outcome, state, bundle, currentNode, currentLocation);
      break;
    }
    case 'inspect':
    case 'ask_world_question':
    case 'free_roleplay':
    default: {
      const currentLocationItemIds = currentLocation.items ?? [];
      if (
        intent.intent === 'inspect' &&
        intent.targetItemId &&
        currentLocationItemIds.includes(intent.targetItemId) &&
        !hasInventoryItem(state, intent.targetItemId)
      ) {
        baseResult.stateChanges.inventoryAdd = {
          [intent.targetItemId]: 1,
        };
        baseResult.actionResults.push(
          buildActionResult(
            'item_gain',
            true,
            `你发现了 ${getDisplayItemName(bundle, intent.targetItemId)}。`,
            { itemId: intent.targetItemId },
          ),
        );
      } else if (
        intent.intent === 'inspect' &&
        !intent.targetItemId &&
        currentLocationItemIds.length === 1 &&
        !hasInventoryItem(state, currentLocationItemIds[0])
      ) {
        const foundItemId = currentLocationItemIds[0];
        baseResult.stateChanges.inventoryAdd = {
          [foundItemId]: 1,
        };
        baseResult.actionResults.push(
          buildActionResult(
            'item_gain',
            true,
            `仔细查看后，你得到了 ${getDisplayItemName(bundle, foundItemId)}。`,
            { itemId: foundItemId },
          ),
        );
      } else {
        const type: PlayEventType =
          intent.intent === 'inspect'
            ? 'inspect'
            : intent.intent === 'ask_world_question'
              ? 'dialogue'
              : 'system';
        baseResult.actionResults.push(
          buildActionResult(
            type,
            true,
            intent.intent === 'inspect'
              ? '你进一步观察了周围环境。'
              : '你的行动暂未直接改变世界状态。',
          ),
        );
      }

      applyOutcomeToResult(baseResult, outcome, state, bundle, currentNode, currentLocation);
      break;
    }
  }

  const previewState = applyRuleResult(state, baseResult, bundle);
  baseResult.stateChanges.currentObjectives = buildObjectives(bundle, previewState);
  previewState.currentObjectives = baseResult.stateChanges.currentObjectives;
  baseResult.allowedNextNodes = buildAllowedNextNodes(bundle, previewState, character);
  return baseResult;
}

export function applyRuleResult(
  state: PlayGameState,
  ruleResult: RuleResult,
  bundle: PlayScriptBundle,
): PlayGameState {
  if (isEventDrivenBundle(bundle)) {
    return applyEventRuleResult(state, ruleResult, bundle);
  }

  const nextState: PlayGameState = {
    ...state,
    inventory: { ...state.inventory },
    flags: { ...state.flags },
    npcStates: { ...state.npcStates },
    recentEvents: [...state.recentEvents],
    currentObjectives: [...state.currentObjectives],
    visitedNodeIds: [...state.visitedNodeIds],
    visitedLocationIds: [...state.visitedLocationIds],
    discoveredLocationIds: [...state.discoveredLocationIds],
    unlockedLocationIds: [...state.unlockedLocationIds],
    unlockedConnectionIds: [...state.unlockedConnectionIds],
    blockedConnectionIds: [...state.blockedConnectionIds],
    completedEventIds: [...state.completedEventIds],
    knowledge: [...state.knowledge],
    attributes: { ...state.attributes },
    worldState: { ...state.worldState },
    updatedAt: Date.now(),
  };
  normalizeInventory(nextState.inventory, bundle);

  for (const [itemId, count] of Object.entries(ruleResult.stateChanges.inventoryAdd ?? {})) {
    addInventoryItem(nextState.inventory, bundle, itemId, count);
  }

  for (const [itemId, count] of Object.entries(ruleResult.stateChanges.inventoryRemove ?? {})) {
    removeInventoryItem(nextState.inventory, itemId, count);
  }

  Object.assign(nextState.flags, ruleResult.stateChanges.flags ?? {});

  for (const [npcId, npcState] of Object.entries(ruleResult.stateChanges.npcStates ?? {})) {
    nextState.npcStates[npcId] = {
      ...(nextState.npcStates[npcId] ?? {}),
      ...npcState,
    };
  }

  if (ruleResult.stateChanges.currentNodeId) {
    nextState.currentNodeId = ruleResult.stateChanges.currentNodeId;
  }

  if (ruleResult.stateChanges.currentLocationId) {
    nextState.currentLocationId = ruleResult.stateChanges.currentLocationId;
  }

  if (ruleResult.stateChanges.status) {
    nextState.status = ruleResult.stateChanges.status;
  }

  if (ruleResult.stateChanges.currentObjectives?.length) {
    nextState.currentObjectives = [...ruleResult.stateChanges.currentObjectives];
  }

  nextState.turnCount += 1;

  if (nextState.currentNodeId && !nextState.visitedNodeIds.includes(nextState.currentNodeId)) {
    nextState.visitedNodeIds.push(nextState.currentNodeId);
  }

  if (
    nextState.currentLocationId &&
    !nextState.visitedLocationIds.includes(nextState.currentLocationId)
  ) {
    nextState.visitedLocationIds.push(nextState.currentLocationId);
  }

  const locationName =
    bundle.locationsById[nextState.currentLocationId]?.name ?? nextState.currentLocationId;
  const latestSummary =
    ruleResult.actionResults.at(-1)?.summary ?? `位于 ${locationName}`;
  nextState.narrativeSummary = [
    ...nextState.recentEvents.map((event) => event.summary),
    latestSummary,
  ]
    .filter(Boolean)
    .slice(-8)
    .join('；');

  return nextState;
}

export function appendGameEvent(
  state: PlayGameState,
  playerInput: string,
  ruleResult: RuleResult,
) {
  const summary = localizeSummaryText(`${playerInput} -> ${ruleResult.actionResults
    .map((item) => item.summary)
    .filter(Boolean)
    .join('；')}`);

  const eventType = (ruleResult.actionResults[0]?.type ?? 'system') as PlayEventType;
  const relatedItemIds = ruleResult.actionResults
    .map((item) => item.itemId)
    .filter(Boolean) as string[];
  const relatedNpcIds = ruleResult.actionResults
    .map((item) => item.npcId)
    .filter(Boolean) as string[];
  const relatedNodeIds = ruleResult.actionResults
    .map((item) => item.nodeId)
    .filter(Boolean) as string[];

  const event: PlayGameEvent = {
    turn: state.turnCount,
    type: eventType,
    summary,
    relatedItemIds,
    relatedNpcIds,
    relatedNodeIds,
  };

  state.recentEvents = [...state.recentEvents, event].slice(-20);
  state.narrativeSummary = state.recentEvents
    .map((item) => item.summary)
    .slice(-10)
    .join('；');
}

export function buildNarrationPrompt(params: {
  bundle: PlayScriptBundle;
  previousState: PlayGameState;
  state: PlayGameState;
  intent: ParsedIntent;
  inputAnalysis: PlayerInputAnalysis;
  ruleResult: RuleResult;
  playerInput: string;
  character: PlayCharacterProfile;
  recentMessages?: PlayMessageRecord[];
}) {
  if (isEventDrivenBundle(params.bundle)) {
    return buildEventNarrationPrompt({
      bundle: params.bundle,
      previousState: params.previousState,
      state: params.state,
      intent: params.intent,
      playerInput: params.playerInput,
      character: params.character,
      recentMessages: params.recentMessages,
      ruleResult: params.ruleResult,
      inputMode: params.inputAnalysis.mode,
      spokenText: params.inputAnalysis.spokenText,
      actionText: params.inputAnalysis.actionText,
      thoughtText: params.inputAnalysis.thoughtText,
    });
  }

  const {
    bundle,
    previousState,
    state,
    intent,
    inputAnalysis,
    ruleResult,
    playerInput,
    character,
    recentMessages = [],
  } = params;
  const currentNode = getCurrentNode(bundle, state);
  const currentLocation = getCurrentLocation(bundle, state);
  const previousNode = getCurrentNode(bundle, previousState);
  const previousLocation = getCurrentLocation(bundle, previousState);
  const presentNpcs = (currentLocation.npcs ?? [])
    .map((npcId) => bundle.npcsById[npcId])
    .filter(Boolean)
    .map((npc) => ({
      npcId: npc.npc_id,
      name: npc.name,
      personality: npc.personality ?? '',
      hostility: npc.hostility ?? 'neutral',
      description: npc.description ?? '',
    }));

  const inventory = Object.entries(state.inventory).map(([itemId, count]) => ({
    name: getDisplayItemName(bundle, itemId),
    count,
  }));

  const compactState = {
    scene: {
      location: currentLocation.name,
      node: currentNode.title,
      description: trimPromptText(
        currentNode.description ?? currentLocation.description ?? '',
        220,
      ),
    },
    status: state.status,
    inventory: inventory.slice(0, 6),
    objectives: state.currentObjectives.slice(0, 4),
    moves: ruleResult.allowedNextNodes.slice(0, 4).map((item) => item.trigger),
    character: {
      name: character.name,
      info: {
        gender: String(character.info.gender ?? '').trim(),
        age: character.info.age,
      },
      metrics: Object.fromEntries(
        Object.entries(character.metrics ?? {}).slice(0, 6),
      ),
    },
  };
  const responseNpcIds = new Set(currentLocation.npcs ?? []);

  const compactContext = {
    before: {
      location: previousLocation.name,
      node: previousNode.title,
      description: trimPromptText(
        previousNode.description ?? previousLocation.description ?? '',
        180,
      ),
    },
    after: {
      location: currentLocation.name,
      node: currentNode.title,
      description: trimPromptText(
        currentNode.description ?? currentLocation.description ?? '',
        180,
      ),
    },
    npcs: presentNpcs.map((npc) => ({
      npcId: npc.npcId,
      name: npc.name,
      hostility: npc.hostility,
      personality: trimPromptText(npc.personality, 60),
    })),
    recent: {
      events: summarizeRecentEvents(state.recentEvents, 4),
      messages: summarizeRecentMessages(recentMessages, 4),
    },
    summary: trimPromptText(state.narrativeSummary, 180),
    responseNpcIds: [...responseNpcIds],
  };

  const compactInput = {
    mode: inputAnalysis.mode,
    text: trimPromptText(
      inputAnalysis.spokenText ??
        inputAnalysis.actionText ??
        inputAnalysis.thoughtText ??
        playerInput,
      160,
    ),
  };

  return [
    '你是受控文字RPG叙事引擎，只能续写当前这一瞬间。',
    '只根据 state、ctx、rule 输出，不得新增不存在的设定、物品、人物或状态。',
    '若 before 与 after 场景不同，先交代转场；若相同，就原地续接。',
    '每回合只写本回合新增的信息、变化、态度或线索；ctx.recent、ctx.summary、before 里已有且本回合未变化的内容不要重复解释。',
    'dialogue 只回应玩家说出口的话；action 只写动作后果；thought 不能被NPC直接听见。',
    '旁白优先写动作结果和新变化，不要复述背景、任务目标或玩家刚做过的动作；控制在2到4句短句内。',
    'NPC台词优先给新线索、新态度或新决定；不要重复地点描述、已知事实和任务目标；每个NPC尽量只说1句短句。',
    'npc_dialogues 只能由 responseNpcIds 内的NPC发言；没有合适回应就返回空数组。',
    '失败只给自然失败反馈，不强推剧情；不要暴露内部ID、检定数值、规则术语。',
    '请严格返回 JSON，不要使用 Markdown 代码块。',
    'schema={"narration":"string","npc_dialogues":[{"npcId":"string","text":"string"}],"feedback":"string","ui_hints":["string"]}',
    stringifyPromptPayload('state', compactState),
    stringifyPromptPayload('ctx', compactContext),
    stringifyPromptPayload('intent', {
      intent: intent.intent,
      targetLocationId: intent.targetLocationId,
      targetNpcId: intent.targetNpcId,
      targetItemId: intent.targetItemId,
    }),
    stringifyPromptPayload('input', compactInput),
    stringifyPromptPayload('rule', summarizeRuleResultForPrompt(ruleResult)),
  ].join('\n');
}

export function normalizeNarrationOutput(raw: string | null) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as NarrationOutput;
    return {
      narration: String(parsed.narration ?? '').trim(),
      npc_dialogues: Array.isArray(parsed.npc_dialogues)
        ? parsed.npc_dialogues
            .map((item) => ({
              npcId: String(item.npcId ?? '').trim(),
              text: String(item.text ?? '').trim(),
            }))
            .filter((item) => item.npcId && item.text)
        : [],
      feedback: String(parsed.feedback ?? '').trim() || undefined,
      ui_hints: Array.isArray(parsed.ui_hints)
        ? parsed.ui_hints.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
        : [],
    } satisfies NarrationOutput;
  } catch {
    return null;
  }
}

export function buildClientSnapshot(
  bundle: PlayScriptBundle,
  state: PlayGameState,
  character: PlayCharacterProfile,
): PlayClientSnapshot {
  if (isEventDrivenBundle(bundle)) {
    return buildEventClientSnapshot(bundle, state, character);
  }

  const currentNode = getCurrentNode(bundle, state);
  const currentLocation = getCurrentLocation(bundle, state);
  const availableMoveLabels = listAvailableConnections(bundle, state, character).map(
    (connection) =>
      bundle.locationsById[connection.target_location_id]?.name ??
      connection.target_location_id,
  );
  const inventory = normalizeInventory({ ...state.inventory }, bundle);
  const inventoryLabels = Object.entries(inventory).map(
    ([itemId, count]) =>
      count > 1
        ? `${getDisplayItemName(bundle, itemId)} x${count}`
        : getDisplayItemName(bundle, itemId),
  );
  const inventoryItems = Object.entries(inventory).map(([itemId, count]) => ({
    itemId,
    name: getDisplayItemName(bundle, itemId),
    count,
    description: String(bundle.itemsById[itemId]?.description ?? '').trim(),
  }));
  const storySummary = localizeSummaryText(state.narrativeSummary);
  const recentEventSummaries = state.recentEvents
    .map((item) => localizeSummaryText(item.summary))
    .slice(-12);
  const completedNodeTitles = state.visitedNodeIds
    .filter((nodeId) => nodeId !== state.currentNodeId || state.status === 'finished')
    .map((nodeId) => bundle.nodesById[nodeId]?.title ?? '')
    .filter(Boolean)
    .reverse();
  const overviewEntries = [
    currentLocation.name ? `当前位置：${currentLocation.name}` : '',
    currentNode.title ? `当前剧情：${currentNode.title}` : '',
    storySummary ? `前情提要：${storySummary}` : '',
    ...recentEventSummaries,
  ]
    .map((item) => String(item).trim())
    .filter(Boolean);

  return {
    sessionId: state.sessionId,
    scriptId: state.scriptId,
    status: state.status,
    turnCount: state.turnCount,
    currentNodeId: state.currentNodeId,
    currentNodeTitle: currentNode.title,
    currentLocationId: currentLocation.location_id,
    currentLocationName: currentLocation.name,
    currentLocationDescription: currentLocation.description ?? '',
    storySummary,
    overviewEntries,
    completedNodeTitles,
    inventoryLabels,
    inventoryItems,
    loadoutLabels: [...state.loadoutLabels],
    objectiveLabels: buildObjectives(bundle, state),
    presentNpcNames: (currentLocation.npcs ?? [])
      .map((npcId) => bundle.npcsById[npcId]?.name)
      .filter(Boolean) as string[],
    availableMoveLabels,
    recentEventSummaries,
  };
}

export function buildWelcomeMessages(
  bundle: PlayScriptBundle,
  state: PlayGameState,
): PlayMessageRecord[] {
  if (isEventDrivenBundle(bundle)) {
    return buildEventWelcomeMessages(bundle, state);
  }

  const currentNode = getCurrentNode(bundle, state);
  const currentLocation = getCurrentLocation(bundle, state);

  return [
    {
      func: 'chat',
      message: `欢迎进入《${bundle.scriptFile.metadata?.title ?? '未命名剧本'}》。`,
      character: 'system',
    },
    {
      func: 'chat',
      message: `${currentNode.title || currentLocation.name}：${currentNode.description ?? currentLocation.description ?? '你已进入故事。'}`,
      character: 'system',
    },
  ];
}

export function buildOpeningPrompt(
  bundle: PlayScriptBundle,
  state: PlayGameState,
  character: PlayCharacterProfile,
) {
  if (isEventDrivenBundle(bundle)) {
    return buildEventOpeningPrompt(bundle, state, character);
  }

  const currentNode = getCurrentNode(bundle, state);
  const currentLocation = getCurrentLocation(bundle, state);
  const presentNpcs = (currentLocation.npcs ?? [])
    .map((npcId) => bundle.npcsById[npcId])
    .filter(Boolean)
    .map((npc) => ({
      npcId: npc.npc_id,
      name: npc.name,
      hostility: npc.hostility ?? 'neutral',
      personality: trimPromptText(npc.personality ?? '', 60),
      description: trimPromptText(npc.description ?? '', 80),
    }));
  const inventory = normalizeInventory({ ...state.inventory }, bundle);

  return [
    '你是文字RPG的开场镜头生成器。',
    '玩家刚进入剧本，还没有行动。请补上一段开场现场感描写。',
    '只写当前所在地的即时感受、环境动静、NPC此刻的动作或简短台词，不要复述系统欢迎语、剧本标题、任务清单或大段背景。',
    '旁白控制在2到4句短句；NPC台词0到2句，每个NPC最多一句；不要推进尚未发生的剧情，不要暴露内部ID或规则信息。',
    '请严格返回 JSON，不要使用 Markdown 代码块。',
    'schema={"narration":"string","npc_dialogues":[{"npcId":"string","text":"string"}],"feedback":"string","ui_hints":["string"]}',
    stringifyPromptPayload('scene', {
      location: currentLocation.name,
      title: currentNode.title || currentLocation.name,
      description: trimPromptText(
        currentNode.description ?? currentLocation.description ?? '',
        220,
      ),
    }),
    stringifyPromptPayload('npcs', presentNpcs.slice(0, 4)),
    stringifyPromptPayload('state', {
      inventory: Object.entries(inventory)
        .slice(0, 6)
        .map(([itemId, count]) => ({
          name: getDisplayItemName(bundle, itemId),
          count,
        })),
      objectives: buildObjectives(bundle, state).slice(0, 4),
      character: {
        name: character.name,
        info: {
          gender: String(character.info.gender ?? '').trim(),
          age: character.info.age,
        },
      },
    }),
  ].join('\n');
}

export function buildOpeningFallbackMessages(
  bundle: PlayScriptBundle,
  state: PlayGameState,
): PlayMessageRecord[] {
  if (isEventDrivenBundle(bundle)) {
    return buildEventOpeningFallbackMessages(bundle, state);
  }

  const currentNode = getCurrentNode(bundle, state);
  const currentLocation = getCurrentLocation(bundle, state);
  const npcNames = (currentLocation.npcs ?? [])
    .map((npcId) => bundle.npcsById[npcId]?.name ?? npcId)
    .filter(Boolean)
    .slice(0, 2);
  const lead =
    trimPromptText(
      currentNode.description ?? currentLocation.description ?? '',
      120,
    ) || `你已经来到 ${currentLocation.name}。`;
  const npcHint = npcNames.length > 0
    ? `附近还能看见 ${npcNames.join('、')}，他们似乎也注意到了你的到来。`
    : '';

  return [
    {
      func: 'chat',
      message: [lead, npcHint].filter(Boolean).join(' '),
      character: 'narrator',
      speaker: '艾达 AIDR（叙述者）',
      mode: 'narration',
    },
  ];
}
