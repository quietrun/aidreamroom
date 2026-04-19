import {
  NarrationOutput,
  ParsedIntent,
  PlayCharacterProfile,
  PlayClientSnapshot,
  PlayEventType,
  PlayGameEvent,
  PlayGameState,
  PlayMessageRecord,
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

const MOVE_KEYWORDS = ['去', '前往', '移动', '走', '进入', '前进', '离开', '到'];
const TALK_KEYWORDS = ['问', '询问', '交谈', '聊天', '搭话', '告诉', '说', '问问'];
const INSPECT_KEYWORDS = ['看', '观察', '检查', '调查', '搜索', '摸索', '翻找', '查看'];
const USE_KEYWORDS = ['用', '使用', '打开', '解锁', '启动', '拿出', '掏出'];
const QUESTION_KEYWORDS = ['吗', '？', '?', '哪里', '谁', '什么', '怎么', '为何', '为什么'];

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

  const nodesByLocationId: Record<string, RawScriptNode[]> = {};
  for (const node of scriptFile.nodes ?? []) {
    const locationId = String(node.location_id ?? '');
    if (!locationId) {
      continue;
    }
    nodesByLocationId[locationId] = nodesByLocationId[locationId] ?? [];
    nodesByLocationId[locationId].push(node);
  }

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
    map,
    npcFile,
    itemFile,
    scriptFile,
    locationsById,
    nodesById,
    nodesByLocationId,
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
      inventory[itemId] = (inventory[itemId] ?? 0) + 1;
    }
  }
  return inventory;
}

export function createInitialGameState(
  sessionId: string,
  bundle: PlayScriptBundle,
  loadoutLabels: string[] = [],
): PlayGameState {
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
    currentLocationId: String(startNode.location_id ?? startLocationId),
    visitedNodeIds: startNode.node_id ? [startNode.node_id] : [],
    visitedLocationIds: startLocationId ? [startLocationId] : [],
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
): ParsedIntent {
  const targetLocationId = findLongestAlias(playerInput, bundle.locationAliases);
  const targetNpcId = findLongestAlias(playerInput, bundle.npcAliases);
  const targetItemId = findLongestAlias(playerInput, bundle.itemAliases);

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

function summarizeOutcome(outcome: RawOutcome) {
  return String(outcome.description ?? '').trim();
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
  bundle: PlayScriptBundle,
  currentNode: RawScriptNode,
  currentLocation: RawLocation,
) {
  if (!outcome) {
    return result;
  }

  const inventoryAdd: Record<string, number> = {};
  for (const itemId of outcome.items_gained ?? []) {
    inventoryAdd[itemId] = (inventoryAdd[itemId] ?? 0) + 1;
  }

  const npcStates: PlayGameState['npcStates'] = {};
  for (const npcId of outcome.npcs_encountered ?? []) {
    npcStates[npcId] = {
      met: true,
      hostility: bundle.npcsById[npcId]?.hostility ?? 'neutral',
    };
  }

  const nextNode =
    outcome.next_node && outcome.next_node !== 'node_end'
      ? bundle.nodesById[outcome.next_node]
      : undefined;
  const nextLocationId =
    outcome.target_location_id ??
    nextNode?.location_id ??
    currentLocation.location_id;

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

  for (const itemId of outcome.items_gained ?? []) {
    result.actionResults.push(
      buildActionResult('item_gain', true, `获得 ${getDisplayItemName(bundle, itemId)}`, {
        itemId,
      }),
    );
  }

  for (const npcId of outcome.npcs_encountered ?? []) {
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
  const currentNode = getCurrentNode(bundle, state);
  const currentLocation = getCurrentLocation(bundle, state);
  const presentNpcIds = [
    ...new Set([
      ...(currentLocation.npcs ?? []),
      ...Object.keys(state.npcStates).filter((npcId) => state.npcStates[npcId]?.met),
    ]),
  ];
  const availableConnections = listAvailableConnections(bundle, state, character);
  const baseResult: RuleResult = {
    success: true,
    actionType: intent.intent,
    actionResults: [],
    stateChanges: {},
    allowedNextNodes: [],
  };

  const { outcome, roll } = matchOutcome(
    playerInput,
    currentNode,
    state,
    character,
    intent,
    bundle,
  );

  if (roll) {
    baseResult.roll = roll;
    baseResult.actionResults.push(
      buildActionResult(
        'roll',
        roll.success,
        `${roll.type} 检定 ${roll.success ? '成功' : '失败'}（${roll.rollData}/${roll.targetData}）`,
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
      applyOutcomeToResult(baseResult, outcome, bundle, currentNode, currentLocation);
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
      applyOutcomeToResult(baseResult, outcome, bundle, currentNode, currentLocation);
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

      applyOutcomeToResult(baseResult, outcome, bundle, currentNode, currentLocation);
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

      applyOutcomeToResult(baseResult, outcome, bundle, currentNode, currentLocation);
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
  const nextState: PlayGameState = {
    ...state,
    inventory: { ...state.inventory },
    flags: { ...state.flags },
    npcStates: { ...state.npcStates },
    recentEvents: [...state.recentEvents],
    currentObjectives: [...state.currentObjectives],
    visitedNodeIds: [...state.visitedNodeIds],
    visitedLocationIds: [...state.visitedLocationIds],
    updatedAt: Date.now(),
  };

  for (const [itemId, count] of Object.entries(ruleResult.stateChanges.inventoryAdd ?? {})) {
    nextState.inventory[itemId] = (nextState.inventory[itemId] ?? 0) + count;
  }

  for (const [itemId, count] of Object.entries(ruleResult.stateChanges.inventoryRemove ?? {})) {
    const nextCount = (nextState.inventory[itemId] ?? 0) - count;
    if (nextCount > 0) {
      nextState.inventory[itemId] = nextCount;
    } else {
      delete nextState.inventory[itemId];
    }
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
    .slice(-5)
    .join('；');

  return nextState;
}

export function appendGameEvent(
  state: PlayGameState,
  playerInput: string,
  ruleResult: RuleResult,
) {
  const summary = `${playerInput} -> ${ruleResult.actionResults
    .map((item) => item.summary)
    .filter(Boolean)
    .join('；')}`;

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

  state.recentEvents = [...state.recentEvents, event].slice(-10);
  state.narrativeSummary = state.recentEvents
    .map((item) => item.summary)
    .slice(-5)
    .join('；');
}

export function buildNarrationPrompt(params: {
  bundle: PlayScriptBundle;
  state: PlayGameState;
  intent: ParsedIntent;
  ruleResult: RuleResult;
  playerInput: string;
  character: PlayCharacterProfile;
}) {
  const { bundle, state, intent, ruleResult, playerInput, character } = params;
  const currentNode = getCurrentNode(bundle, state);
  const currentLocation = getCurrentLocation(bundle, state);
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
    itemId,
    name: getDisplayItemName(bundle, itemId),
    count,
  }));

  const authoritativeState = {
    sessionId: state.sessionId,
    scriptId: state.scriptId,
    currentNodeId: state.currentNodeId,
    currentLocationId: state.currentLocationId,
    currentLocationName: currentLocation.name,
    status: state.status,
    inventory,
    loadoutLabels: state.loadoutLabels,
    objectives: state.currentObjectives,
    allowedNextNodes: ruleResult.allowedNextNodes,
  };

  const flavorContext = {
    scene: {
      title: currentNode.title,
      description: currentNode.description ?? '',
      locationDescription: currentLocation.description ?? '',
      events: currentLocation.events ?? [],
    },
    presentNpcs,
    recentEvents: state.recentEvents.slice(-6),
    narrativeSummary: state.narrativeSummary,
    character: {
      name: character.name,
      info: character.info,
    },
  };

  return [
    '你是受控的文字 RPG 叙事引擎。',
    '你只能基于 authoritative_state、flavor_context、rule_result 输出，不得创造不存在的地点、物品、NPC、结局或状态变化。',
    '如果 rule_result.success 为 false，需要写出合理失败反馈，但不能强行推进剧情。',
    '输出只面向玩家阅读的故事内容：narration 写旁白，npc_dialogues 写 NPC 台词。',
    '不要在输出中展示 roll 点、属性名、点数、目标数值、检定结果、规则执行摘要或“当前场景”这类系统信息。',
    '请严格返回 JSON，不要使用 Markdown 代码块。',
    'JSON Schema: {"narration":"string","npc_dialogues":[{"npcId":"string","text":"string"}],"feedback":"string","ui_hints":["string"]}',
    `authoritative_state=${JSON.stringify(authoritativeState)}`,
    `flavor_context=${JSON.stringify(flavorContext)}`,
    `parsed_intent=${JSON.stringify(intent)}`,
    `rule_result=${JSON.stringify(ruleResult)}`,
    `player_input=${JSON.stringify(playerInput)}`,
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
  const currentNode = getCurrentNode(bundle, state);
  const currentLocation = getCurrentLocation(bundle, state);
  const availableMoveLabels = listAvailableConnections(bundle, state, character).map(
    (connection) =>
      bundle.locationsById[connection.target_location_id]?.name ??
      connection.target_location_id,
  );
  const inventoryLabels = Object.entries(state.inventory).map(
    ([itemId, count]) =>
      count > 1
        ? `${getDisplayItemName(bundle, itemId)} x${count}`
        : getDisplayItemName(bundle, itemId),
  );

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
    inventoryLabels,
    loadoutLabels: [...state.loadoutLabels],
    objectiveLabels: buildObjectives(bundle, state),
    presentNpcNames: (currentLocation.npcs ?? [])
      .map((npcId) => bundle.npcsById[npcId]?.name)
      .filter(Boolean) as string[],
    availableMoveLabels,
    recentEventSummaries: state.recentEvents.map((item) => item.summary).slice(-6),
  };
}

export function buildWelcomeMessages(
  bundle: PlayScriptBundle,
  state: PlayGameState,
): PlayMessageRecord[] {
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
