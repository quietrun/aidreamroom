import {
  AiTurnOutput,
  NarrationOutput,
  ParsedIntent,
  PlayerIntentType,
  PlayCharacterProfile,
  PlayClientSnapshot,
  PlayGameState,
  PlayLoadoutItem,
  PlayMessageRecord,
  PlayRollResult,
  PlayScriptBundle,
  RawCondition,
  RawConditionLogic,
  RawEventChoice,
  RawEventEffects,
  RawItem,
  RawItemUseRule,
  RawLocation,
  RawLocationAccessMethod,
  RawLocationConnection,
  RawScriptEvent,
  RuleActionResult,
  RuleResult,
  ValueMap,
} from './play-runtime.types';
import {
  stringifyPromptPayload,
  summarizeRecentEvents,
  summarizeRecentMessages,
  summarizeRuleResultForPrompt,
  trimPromptText,
} from './play-runtime.prompt.util';

const DIFFICULTY_RATE: Record<string, number> = {
  easy: 1,
  normal: 0.8,
  medium: 0.8,
  hard: 0.6,
  extreme: 0.4,
  critical: 0.2,
  none: 1,
};

type EventResolutionContext = {
  previousLocationId: string;
  currentLocationId: string;
  timings: Set<string>;
  explicitEventIds: Set<string>;
  discoveredLocationIds: Set<string>;
  unlockedLocationIds: Set<string>;
  unlockedConnectionIds: Set<string>;
  blockedConnectionIds: Set<string>;
  addedItemIds: Set<string>;
  removedItemIds: Set<string>;
  targetNpcId?: string;
  targetItemId?: string;
  targetItemUseRuleId?: string;
  playerIntent?: PlayerIntentType;
  playerInput?: string;
  roll?: PlayRollResult;
};

function cloneValueMap(map: ValueMap | undefined) {
  return { ...(map ?? {}) };
}

function cloneState(state: PlayGameState): PlayGameState {
  return {
    ...state,
    inventory: { ...state.inventory },
    flags: { ...state.flags },
    npcStates: JSON.parse(JSON.stringify(state.npcStates ?? {})) as PlayGameState['npcStates'],
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
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))];
}

function normalizeText(value: string) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\s\r\n\t`~!@#$%^&*()_\-+=[\]{}\\|;:'"，。、《》？?！、：]/g, '');
}

function compareValue(
  actual: unknown,
  operator: string,
  expected: unknown,
  fallback?: unknown,
): boolean {
  const normalizedExpected = expected === undefined ? fallback : expected;

  switch (operator) {
    case 'exists':
      if (Array.isArray(actual)) {
        return actual.length > 0;
      }
      if (typeof actual === 'number') {
        return actual > 0;
      }
      return actual !== undefined && actual !== null && actual !== false && actual !== '';
    case 'not_exists':
      return !compareValue(actual, 'exists', normalizedExpected, fallback);
    case 'contains': {
      const target = String(normalizedExpected ?? fallback ?? '');
      if (Array.isArray(actual)) {
        return actual.map((item) => String(item)).includes(target);
      }
      return String(actual ?? '').includes(target);
    }
    case 'not_contains':
      return !compareValue(actual, 'contains', normalizedExpected, fallback);
    case '>=':
      return Number(actual ?? 0) >= Number(normalizedExpected ?? 0);
    case '<=':
      return Number(actual ?? 0) <= Number(normalizedExpected ?? 0);
    case '>':
      return Number(actual ?? 0) > Number(normalizedExpected ?? 0);
    case '<':
      return Number(actual ?? 0) < Number(normalizedExpected ?? 0);
    case '!=':
      return String(actual ?? '') !== String(normalizedExpected ?? '');
    case '==':
    default:
      return String(actual ?? '') === String(normalizedExpected ?? '');
  }
}

function getDisplayItemName(bundle: PlayScriptBundle, itemId: string) {
  return bundle.itemsById[itemId]?.name ?? itemId;
}

function getDisplayNpcName(bundle: PlayScriptBundle, npcId: string) {
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

function getCurrentLocation(bundle: PlayScriptBundle, state: PlayGameState) {
  return (
    bundle.locationsById[state.currentLocationId] ??
    bundle.map.locations?.[0] ?? {
      location_id: state.currentLocationId,
      name: state.currentLocationId || '未知地点',
      description: '',
      connections: [],
      items: [],
      npcs: [],
    }
  );
}

function getCurrentEvent(bundle: PlayScriptBundle, state: PlayGameState) {
  return state.currentEventId ? bundle.eventsById[state.currentEventId] : undefined;
}

function getEventPlayerText(event: RawScriptEvent | undefined) {
  return String(
    event?.player_facing_text ??
      event?.description ??
      event?.narrative_detail?.scene ??
      event?.title ??
      '',
  ).trim();
}

function getEventNarrativeDetail(event: RawScriptEvent | undefined) {
  const detail = event?.narrative_detail;
  if (!detail) {
    return undefined;
  }

  return {
    scene: trimPromptText(detail.scene ?? '', 120),
    goal: trimPromptText(detail.player_goal ?? '', 80),
    clue: trimPromptText(detail.clue_or_threat ?? '', 100),
    reason: trimPromptText(detail.mechanical_reason ?? '', 120),
  };
}

function getEventSemanticText(event: RawScriptEvent | undefined) {
  const detail = event?.narrative_detail;
  return [
    event?.title,
    event?.player_facing_text,
    event?.description,
    detail?.scene,
    detail?.player_goal,
    detail?.clue_or_threat,
    detail?.mechanical_reason,
  ]
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

function getPresentNpcIds(
  bundle: PlayScriptBundle,
  state: PlayGameState,
  locationId: string,
) {
  const location = bundle.locationsById[locationId];
  const baseIds = location?.npcs ?? [];
  return uniqueStrings(
    baseIds.filter((npcId) => state.npcStates[npcId]?.custom?.despawned !== true),
  );
}

function performConfiguredRoll(
  type: string | undefined,
  difficulty: string | undefined,
  state: PlayGameState,
  character: PlayCharacterProfile,
): PlayRollResult {
  const rollType = String(type ?? 'luck').toLowerCase();
  const difficultyKey = String(difficulty ?? 'normal').toLowerCase();
  const baseValue = Number(
    state.attributes[rollType] ??
      character.metrics[rollType] ??
      (character.info[rollType] as number | undefined) ??
      50,
  );
  const rate = DIFFICULTY_RATE[difficultyKey] ?? DIFFICULTY_RATE.normal;
  const targetData = Math.max(1, Math.floor(baseValue * rate));
  const rollData = Math.floor(Math.random() * 100) + 1;

  return {
    type: rollType,
    difficulty: difficultyKey,
    rollData,
    targetData,
    success: rollData <= targetData,
  };
}

function evaluateCondition(
  condition: RawCondition | undefined,
  state: PlayGameState,
  bundle: PlayScriptBundle,
  character: PlayCharacterProfile,
  context: EventResolutionContext,
) {
  if (!condition) {
    return true;
  }

  const type = String(condition.type ?? '').toLowerCase();
  const name = String(condition.name ?? '');
  const operator = String(condition.operator ?? '==');
  const expected = condition.value;
  const currentNpcIds = getPresentNpcIds(bundle, state, context.currentLocationId);

  switch (type) {
    case 'item':
    case 'inventory_count':
      return compareValue(state.inventory[name] ?? 0, operator, expected, 0);
    case 'flag':
      return compareValue(state.flags[name], operator, expected);
    case 'attribute':
    case 'fear':
      return compareValue(
        state.attributes[name] ??
          character.metrics[name] ??
          (character.info[name] as number | undefined),
        operator,
        expected,
      );
    case 'knowledge':
      return compareValue(state.knowledge, operator, expected, name);
    case 'time':
      return compareValue(state.timeValue, operator, expected);
    case 'state':
      return compareValue(state.worldState[name], operator, expected);
    case 'location':
      if (name === 'current_location' || !name) {
        return compareValue(context.currentLocationId, operator, expected);
      }
      return compareValue(context.currentLocationId, operator, expected ?? name);
    case 'location_discovered':
      return compareValue(state.discoveredLocationIds, operator, expected, name);
    case 'location_unlocked':
      return compareValue(state.unlockedLocationIds, operator, expected, name);
    case 'connection_unlocked':
      return compareValue(state.unlockedConnectionIds, operator, expected, name);
    case 'event_completed':
      return compareValue(state.completedEventIds, operator, expected, name);
    case 'event_not_completed':
      return !compareValue(state.completedEventIds, 'contains', expected, name);
    case 'npc':
      return compareValue(currentNpcIds, operator, expected, name);
    case 'roll_result':
      return compareValue(context.roll?.success ? 'success' : 'failure', operator, expected);
    default:
      return compareValue(state.flags[name] ?? state.worldState[name], operator, expected);
  }
}

function evaluateConditionLogic(
  logic: RawConditionLogic | undefined,
  state: PlayGameState,
  bundle: PlayScriptBundle,
  character: PlayCharacterProfile,
  context: EventResolutionContext,
): boolean {
  if (!logic) {
    return true;
  }

  const operator = String(logic.operator ?? 'AND').toUpperCase();
  const results: boolean[] = [
    ...(logic.conditions ?? []).map((condition) =>
      evaluateCondition(condition, state, bundle, character, context),
    ),
    ...(logic.groups ?? []).map((group) =>
      evaluateConditionLogic(group, state, bundle, character, context),
    ),
  ];

  if (results.length === 0) {
    return true;
  }

  return operator === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

function markLocationDiscovered(state: PlayGameState, context: EventResolutionContext, locationId: string) {
  if (!locationId || state.discoveredLocationIds.includes(locationId)) {
    return;
  }
  state.discoveredLocationIds.push(locationId);
  context.discoveredLocationIds.add(locationId);
  context.timings.add('on_location_discovered');
}

function markLocationUnlocked(state: PlayGameState, context: EventResolutionContext, locationId: string) {
  if (!locationId || state.unlockedLocationIds.includes(locationId)) {
    return;
  }
  state.unlockedLocationIds.push(locationId);
  context.unlockedLocationIds.add(locationId);
  context.timings.add('on_location_unlocked');
  context.timings.add('on_unlock');
}

function markConnectionUnlocked(
  state: PlayGameState,
  context: EventResolutionContext,
  connectionId: string,
) {
  if (!connectionId || state.unlockedConnectionIds.includes(connectionId)) {
    return;
  }
  state.unlockedConnectionIds.push(connectionId);
  state.blockedConnectionIds = state.blockedConnectionIds.filter((id) => id !== connectionId);
  context.unlockedConnectionIds.add(connectionId);
  context.timings.add('on_connection_unlocked');
  context.timings.add('on_unlock');
}

function markConnectionBlocked(
  state: PlayGameState,
  context: EventResolutionContext,
  connectionId: string,
) {
  if (!connectionId || state.blockedConnectionIds.includes(connectionId)) {
    return;
  }
  state.blockedConnectionIds.push(connectionId);
  state.unlockedConnectionIds = state.unlockedConnectionIds.filter((id) => id !== connectionId);
  context.blockedConnectionIds.add(connectionId);
  context.timings.add('on_state_changed');
}

function addKnowledge(state: PlayGameState, knowledge: string[]) {
  for (const item of knowledge) {
    const normalized = String(item ?? '').trim();
    if (!normalized || state.knowledge.includes(normalized)) {
      continue;
    }
    state.knowledge.push(normalized);
  }
}

function setNpcCustomFlag(
  state: PlayGameState,
  npcId: string,
  key: string,
  value: string | number | boolean,
) {
  state.npcStates[npcId] = {
    ...(state.npcStates[npcId] ?? {}),
    custom: {
      ...(state.npcStates[npcId]?.custom ?? {}),
      [key]: value,
    },
  };
}

function applyEventEffects(
  effects: RawEventEffects | undefined,
  draft: PlayGameState,
  bundle: PlayScriptBundle,
  context: EventResolutionContext,
) {
  if (!effects) {
    return;
  }

  Object.assign(draft.flags, effects.set_flags ?? {});
  Object.assign(draft.worldState, effects.set_state ?? {});
  context.timings.add('on_state_changed');

  for (const [attribute, delta] of Object.entries(effects.modify_attributes ?? {})) {
    draft.attributes[attribute] = Number(draft.attributes[attribute] ?? 0) + Number(delta ?? 0);
  }

  for (const itemId of effects.add_items ?? []) {
    if (addInventoryItem(draft.inventory, bundle, itemId) <= 0) {
      continue;
    }
    context.addedItemIds.add(itemId);
    context.timings.add('on_item_acquired');
  }

  for (const itemId of effects.remove_items ?? []) {
    if (removeInventoryItem(draft.inventory, itemId) > 0) {
      context.removedItemIds.add(itemId);
    }
  }

  addKnowledge(draft, effects.add_knowledge ?? []);

  for (const locationId of effects.discover_locations ?? []) {
    markLocationDiscovered(draft, context, locationId);
  }

  for (const locationId of effects.unlock_locations ?? []) {
    markLocationDiscovered(draft, context, locationId);
    markLocationUnlocked(draft, context, locationId);
  }

  for (const connectionId of effects.unlock_connections ?? []) {
    markConnectionUnlocked(draft, context, connectionId);
  }

  for (const connectionId of effects.lock_connections ?? []) {
    markConnectionBlocked(draft, context, connectionId);
  }

  for (const npcId of effects.spawn_npcs ?? []) {
    setNpcCustomFlag(draft, npcId, 'despawned', false);
  }

  for (const npcId of effects.despawn_npcs ?? []) {
    setNpcCustomFlag(draft, npcId, 'despawned', true);
  }

  for (const eventId of effects.trigger_events ?? []) {
    if (bundle.eventsById[eventId]) {
      context.explicitEventIds.add(eventId);
    }
  }

  if (effects.consume_item && context.targetItemId) {
    if (removeInventoryItem(draft.inventory, context.targetItemId) > 0) {
      context.removedItemIds.add(context.targetItemId);
    }
  }

  if (Number(effects.advance_time ?? 0) !== 0) {
    draft.timeValue += Number(effects.advance_time ?? 0);
    context.timings.add('on_time_reached');
  }
}

function applyMethodEffectSet(
  effects: RawLocationAccessMethod['effects'] | RawLocationAccessMethod['success_effects'] | RawLocationAccessMethod['failure_effects'],
  draft: PlayGameState,
  context: EventResolutionContext,
  target: { locationId?: string; connectionId?: string },
) {
  if (!effects) {
    return;
  }

  Object.assign(draft.flags, effects.set_flags ?? {});

  for (const [attribute, delta] of Object.entries(effects.modify_attributes ?? {})) {
    draft.attributes[attribute] = Number(draft.attributes[attribute] ?? 0) + Number(delta ?? 0);
  }

  if (Number(effects.advance_time ?? 0) !== 0) {
    draft.timeValue += Number(effects.advance_time ?? 0);
    context.timings.add('on_time_reached');
  }

  if (effects.discover_location && target.locationId) {
    markLocationDiscovered(draft, context, target.locationId);
  }

  if (effects.unlock_location && target.locationId) {
    markLocationDiscovered(draft, context, target.locationId);
    markLocationUnlocked(draft, context, target.locationId);
  }

  if (effects.unlock_connection && target.connectionId) {
    markConnectionUnlocked(draft, context, target.connectionId);
  }

  for (const eventId of effects.trigger_events ?? []) {
    context.explicitEventIds.add(eventId);
  }

  context.timings.add('on_state_changed');
}

function scoreMethod(method: RawLocationAccessMethod) {
  const requiresRoll = Boolean(method.roll_check?.required);
  return requiresRoll ? 10 : 0;
}

function resolveMethodAttempt(params: {
  method: RawLocationAccessMethod;
  draft: PlayGameState;
  bundle: PlayScriptBundle;
  character: PlayCharacterProfile;
  context: EventResolutionContext;
  target: { locationId?: string; connectionId?: string };
}) {
  const { method, draft, bundle, character, context, target } = params;
  if (!evaluateConditionLogic(method.condition_logic, draft, bundle, character, context)) {
    return { applicable: false, granted: false } as const;
  }

  if (method.npc_interaction?.required) {
    const requiredNpcId = String(method.npc_interaction.npc_id ?? '').trim();
    if (!requiredNpcId) {
      return { applicable: false, granted: false } as const;
    }
    const presentNpcIds = getPresentNpcIds(bundle, draft, context.currentLocationId);
    if (!presentNpcIds.includes(requiredNpcId)) {
      return { applicable: false, granted: false } as const;
    }
  }

  if (method.roll_check?.required) {
    const roll = performConfiguredRoll(
      method.roll_check.roll_type,
      method.roll_check.difficulty,
      draft,
      character,
    );
    context.roll = roll;
    if (roll.success) {
      applyMethodEffectSet(method.success_effects ?? method.effects, draft, context, target);
      return { applicable: true, granted: true, roll } as const;
    }

    applyMethodEffectSet(method.failure_effects, draft, context, target);
    const granted = target.connectionId
      ? method.failure_effects?.remain_locked === false
      : method.failure_effects?.blocked === false;
    return { applicable: true, granted, roll } as const;
  }

  applyMethodEffectSet(method.effects ?? method.success_effects, draft, context, target);
  return { applicable: true, granted: true } as const;
}

function isConnectionPassableWithoutMethod(connection: RawLocationConnection, state: PlayGameState) {
  const connectionId = String(connection.connection_id ?? '');
  if (connectionId && state.blockedConnectionIds.includes(connectionId)) {
    return false;
  }
  if (connectionId && state.unlockedConnectionIds.includes(connectionId)) {
    return true;
  }
  if (connection.traversal_control) {
    return connection.locked !== true && connection.traversal_control.default_traversable !== false;
  }
  return connection.locked !== true;
}

function isLocationAccessibleWithoutMethod(location: RawLocation, state: PlayGameState) {
  if (state.unlockedLocationIds.includes(location.location_id)) {
    return true;
  }
  return location.access_control?.reachable_by_default !== false;
}

function listAttemptableConnections(
  bundle: PlayScriptBundle,
  state: PlayGameState,
  character: PlayCharacterProfile,
) {
  const currentLocation = getCurrentLocation(bundle, state);
  return (currentLocation.connections ?? [])
    .map((connection) => {
      const targetLocation = bundle.locationsById[connection.target_location_id];
      if (!targetLocation) {
        return null;
      }

      if (isConnectionPassableWithoutMethod(connection, state)) {
        return { connection, targetLocation, attemptable: true };
      }

      const draft = cloneState(state);
      const context: EventResolutionContext = {
        previousLocationId: state.currentLocationId,
        currentLocationId: state.currentLocationId,
        timings: new Set<string>(),
        explicitEventIds: new Set<string>(),
        discoveredLocationIds: new Set<string>(),
        unlockedLocationIds: new Set<string>(),
        unlockedConnectionIds: new Set<string>(),
        blockedConnectionIds: new Set<string>(),
        addedItemIds: new Set<string>(),
        removedItemIds: new Set<string>(),
      };
      const methods = [...(connection.traversal_control?.unlock_methods ?? [])].sort(
        (left, right) => scoreMethod(left) - scoreMethod(right),
      );
      const applicable = methods.some((method) =>
        resolveMethodAttempt({
          method,
          draft,
          bundle,
          character,
          context,
          target: { connectionId: connection.connection_id },
        }).applicable,
      );

      return { connection, targetLocation, attemptable: applicable };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => item.attemptable);
}

function moveToLocation(
  draft: PlayGameState,
  bundle: PlayScriptBundle,
  character: PlayCharacterProfile,
  targetLocationId: string,
  context: EventResolutionContext,
  result: RuleResult,
) {
  const currentLocation = getCurrentLocation(bundle, draft);
  const connection = (currentLocation.connections ?? []).find(
    (item) => item.target_location_id === targetLocationId,
  );
  if (!connection) {
    result.success = false;
    result.reason = '目标地点当前不可达';
    result.actionResults.push({
      type: 'move',
      success: false,
      summary: `${bundle.locationsById[targetLocationId]?.name ?? targetLocationId} 当前无法抵达。`,
    });
    return;
  }

  let moved = isConnectionPassableWithoutMethod(connection, draft);
  if (!moved) {
    const methods = [...(connection.traversal_control?.unlock_methods ?? [])].sort(
      (left, right) => scoreMethod(left) - scoreMethod(right),
    );

    for (const method of methods) {
      const attempt = resolveMethodAttempt({
        method,
        draft,
        bundle,
        character,
        context,
        target: { connectionId: connection.connection_id },
      });
      if (!attempt.applicable) {
        continue;
      }

      if (attempt.roll) {
        result.roll = attempt.roll;
        result.actionResults.push({
          type: 'roll',
          success: attempt.roll.success,
          summary: `${attempt.roll.type}检定${attempt.roll.success ? '成功' : '失败'}（${attempt.roll.rollData}/${attempt.roll.targetData}）`,
        });
      }

      if (attempt.granted) {
        moved = true;
      }
      break;
    }
  }

  if (!moved) {
    result.success = false;
    result.reason = '连接尚未解锁';
    result.actionResults.push({
      type: 'move',
      success: false,
      summary: '前路仍被阻挡，你暂时无法通过。',
    });
    return;
  }

  const targetLocation = bundle.locationsById[targetLocationId];
  let locationEntered = isLocationAccessibleWithoutMethod(targetLocation, draft);
  if (!locationEntered) {
    const methods = [...(targetLocation.access_control?.entry_methods ?? [])].sort(
      (left, right) => scoreMethod(left) - scoreMethod(right),
    );
    for (const method of methods) {
      const attempt = resolveMethodAttempt({
        method,
        draft,
        bundle,
        character,
        context,
        target: { locationId: targetLocationId },
      });
      if (!attempt.applicable) {
        continue;
      }

      if (attempt.roll) {
        result.roll = attempt.roll;
        result.actionResults.push({
          type: 'roll',
          success: attempt.roll.success,
          summary: `${attempt.roll.type}检定${attempt.roll.success ? '成功' : '失败'}（${attempt.roll.rollData}/${attempt.roll.targetData}）`,
        });
      }

      if (attempt.granted) {
        locationEntered = true;
      }
      break;
    }
  }

  if (!locationEntered) {
    result.success = false;
    result.reason = '地点尚未开放';
    result.actionResults.push({
      type: 'move',
      success: false,
      summary: `${targetLocation.name} 目前还不能进入。`,
    });
    return;
  }

  context.previousLocationId = draft.currentLocationId;
  draft.currentLocationId = targetLocationId;
  draft.currentEventId = undefined;
  draft.currentNodeId = targetLocationId;
  context.currentLocationId = targetLocationId;
  markLocationDiscovered(draft, context, targetLocationId);
  markLocationUnlocked(draft, context, targetLocationId);
  context.timings.add('on_enter');

  result.actionResults.push({
    type: 'move',
    success: true,
    summary: `前往 ${targetLocation.name}`,
    locationId: targetLocationId,
    nodeId: targetLocationId,
  });
}

function applyItemUsage(
  draft: PlayGameState,
  bundle: PlayScriptBundle,
  item: RawItem,
  character: PlayCharacterProfile,
  context: EventResolutionContext,
) {
  context.timings.add('on_interact');

  const useRule = selectItemUseRule(item.use_rules ?? [], draft, bundle, character, context);
  if (useRule) {
    applyEventEffects(useRule.effects, draft, bundle, context);
    return;
  }

  if ((item.use_rules ?? []).length > 0) {
    const fallbackFailureRule = (item.use_rules ?? []).find((rule) => rule.failure_effects);
    applyEventEffects(fallbackFailureRule?.failure_effects, draft, bundle, context);
    return;
  }

  for (const effect of item.effects ?? []) {
    const effectType = String(effect.effect_type ?? '').toLowerCase();
    const target = String(effect.target ?? '');
    const value = effect.value;

    switch (effectType) {
      case 'unlock':
        if (target.startsWith('conn_')) {
          markConnectionUnlocked(draft, context, target);
        } else if (target.startsWith('loc_')) {
          markLocationDiscovered(draft, context, target);
          markLocationUnlocked(draft, context, target);
        }
        break;
      case 'knowledge':
        addKnowledge(draft, [String(value ?? target).trim()]);
        context.timings.add('on_state_changed');
        break;
      case 'flag':
        draft.flags[target] = (value as string | number | boolean | undefined) ?? true;
        context.timings.add('on_state_changed');
        break;
      case 'state':
        draft.worldState[target] = (value as string | number | boolean | undefined) ?? true;
        context.timings.add('on_state_changed');
        break;
      case 'sanity':
      case 'damage':
      case 'heal':
      case 'buff':
      case 'special':
        if (target) {
          draft.attributes[target] =
            Number(draft.attributes[target] ?? 0) + Number(value ?? 0);
          context.timings.add('on_state_changed');
        }
        break;
      case 'trigger_event':
        if (target) {
          context.explicitEventIds.add(target);
        }
        break;
      default:
        break;
    }
  }
}

function selectItemUseRule(
  rules: RawItemUseRule[],
  draft: PlayGameState,
  bundle: PlayScriptBundle,
  character: PlayCharacterProfile,
  context: EventResolutionContext,
) {
  const applicableRules = rules.filter((rule) => {
    if (rule.usable === false) {
      return false;
    }

    const usableAt = (rule.usable_at ?? []).map((item) => String(item ?? '').trim()).filter(Boolean);
    if (
      usableAt.length > 0 &&
      !usableAt.includes(draft.currentLocationId) &&
      !usableAt.includes('global') &&
      !usableAt.includes('*')
    ) {
      return false;
    }

    return evaluateConditionLogic(rule.condition_logic, draft, bundle, character, context);
  });

  const explicitRule = applicableRules.find(
    (rule) => rule.use_id && rule.use_id === context.targetItemUseRuleId,
  );
  if (explicitRule) {
    return explicitRule;
  }
  if (context.targetItemUseRuleId) {
    return undefined;
  }

  const textMatchedRule = applicableRules.find((rule) =>
    textMeaningfullyOverlaps(
      context.playerInput,
      [
        rule.description,
        rule.usage_type,
        ...(rule.target_ids ?? []),
        rule.use_id,
      ]
        .map((item) => String(item ?? '').trim())
        .filter(Boolean)
        .join(' '),
    ),
  );
  if (textMatchedRule) {
    return textMatchedRule;
  }

  return undefined;
}

function eventBindingMatches(
  event: RawScriptEvent,
  state: PlayGameState,
  context: EventResolutionContext,
) {
  const binding = event.location_binding;
  const scope = String(binding?.scope ?? 'location').toLowerCase();
  if (scope === 'global') {
    return true;
  }

  const boundIds = uniqueStrings([binding?.location_id ?? undefined, ...(binding?.location_ids ?? [])]);

  if (boundIds.length === 0) {
    return true;
  }

  return boundIds.includes(state.currentLocationId);
}

function eventTimingMatches(event: RawScriptEvent, context: EventResolutionContext) {
  const timing = String(event.trigger?.trigger_timing ?? 'anytime').toLowerCase();
  if (!timing || timing === 'anytime') {
    return true;
  }
  return context.timings.has(timing);
}

function eventTypeMatches(event: RawScriptEvent, context: EventResolutionContext) {
  const triggerType = String(event.trigger?.trigger_type ?? 'conditional').toLowerCase();

  switch (triggerType) {
    case 'auto':
      return context.timings.has('on_enter') || context.timings.has('after_event');
    case 'npc':
      return Boolean(context.targetNpcId);
    case 'item':
      return Boolean(context.targetItemId) || context.addedItemIds.size > 0;
    case 'time':
      return context.timings.has('on_time_reached');
    case 'state':
      return context.timings.has('on_state_changed');
    case 'location_access':
      return (
        context.timings.has('on_location_unlocked') ||
        context.timings.has('on_connection_unlocked') ||
        context.timings.has('on_unlock')
      );
    case 'active':
      return (
        context.timings.has('on_search') ||
        context.timings.has('on_interact') ||
        context.timings.has('on_enter')
      );
    case 'conditional':
    case 'composite':
    default:
      return true;
  }
}

function eventNarrativeMatchesPlayerInput(event: RawScriptEvent, context: EventResolutionContext) {
  if (!context.playerInput) {
    return true;
  }

  const triggerType = String(event.trigger?.trigger_type ?? '').toLowerCase();
  if (triggerType === 'auto') {
    return true;
  }

  if (!event.narrative_detail) {
    return true;
  }

  return textMeaningfullyOverlaps(context.playerInput, getEventSemanticText(event));
}

function sortEventCandidates(
  left: RawScriptEvent,
  right: RawScriptEvent,
  explicitEventIds: Set<string>,
) {
  const leftExplicit = explicitEventIds.has(left.event_id) ? 1 : 0;
  const rightExplicit = explicitEventIds.has(right.event_id) ? 1 : 0;
  if (leftExplicit !== rightExplicit) {
    return rightExplicit - leftExplicit;
  }

  const leftPriority = Number(left.trigger?.priority ?? 0);
  const rightPriority = Number(right.trigger?.priority ?? 0);
  if (leftPriority !== rightPriority) {
    return rightPriority - leftPriority;
  }

  return Number(left.sequence_index ?? 0) - Number(right.sequence_index ?? 0);
}

function choiceIntentMatches(choice: RawEventChoice, context: EventResolutionContext) {
  const choiceIntent = String(choice.choice_intent ?? '').toLowerCase();
  if (!choiceIntent || !context.playerIntent) {
    return false;
  }

  const normalizedIntent = String(context.playerIntent).toLowerCase();
  if (choiceIntent === normalizedIntent) {
    return true;
  }

  const aliases: Record<string, string[]> = {
    inspect: ['investigate', 'search', 'observe', 'read', 'study'],
    talk_to_npc: ['talk', 'persuade', 'question', 'ask', 'trade', 'help'],
    use_item: ['use', 'unlock', 'consume', 'offer'],
    move: ['move', 'enter', 'leave', 'travel'],
    free_roleplay: ['act', 'risk', 'special'],
  };

  return (aliases[normalizedIntent] ?? []).includes(choiceIntent);
}

function textMeaningfullyOverlaps(left: string | undefined, right: string | undefined) {
  const normalizedLeft = normalizeText(left ?? '');
  const normalizedRight = normalizeText(right ?? '');
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
    return true;
  }

  const rightTokens =
    String(right ?? '')
      .match(/[\p{Script=Han}]{2,}|[a-zA-Z0-9_]{3,}/gu)
      ?.map((item) => normalizeText(item))
      .filter((item) => item.length >= 2) ?? [];

  if (rightTokens.length === 0) {
    return false;
  }

  const matched = rightTokens.filter((token) => normalizedLeft.includes(token)).length;
  return matched >= Math.min(2, rightTokens.length);
}

function selectEventChoice(event: RawScriptEvent, draft: PlayGameState, bundle: PlayScriptBundle, character: PlayCharacterProfile, context: EventResolutionContext) {
  const availableChoices = (event.choices ?? []).filter((choice) =>
    evaluateConditionLogic(choice.condition_logic, draft, bundle, character, context),
  );

  const intentMatchedChoice = availableChoices.find((choice) => choiceIntentMatches(choice, context));
  if (intentMatchedChoice) {
    return intentMatchedChoice;
  }

  for (const choice of availableChoices) {
    if (
      context.playerInput &&
      normalizeText(context.playerInput).includes(normalizeText(choice.text ?? ''))
    ) {
      return choice;
    }
  }

  const narrativeMatchedChoice = availableChoices.find((choice) =>
    textMeaningfullyOverlaps(
      context.playerInput,
      [
        choice.text,
        choice.result_preview,
        choice.risk_hint,
        event.narrative_detail?.player_goal,
        event.narrative_detail?.clue_or_threat,
      ]
        .map((item) => String(item ?? '').trim())
        .filter(Boolean)
        .join(' '),
    ),
  );
  if (narrativeMatchedChoice) {
    return narrativeMatchedChoice;
  }

  return availableChoices[0];
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

function finalizeEvent(
  event: RawScriptEvent,
  selectedChoice: RawEventChoice | undefined,
  draft: PlayGameState,
  bundle: PlayScriptBundle,
  context: EventResolutionContext,
  result?: RuleResult,
) {
  if (event.roll_check?.required) {
    const roll = performConfiguredRoll(
      event.roll_check.roll_type,
      event.roll_check.difficulty,
      draft,
      {
        id: '',
        name: '',
        image: '',
        info: {},
        metrics: draft.attributes,
      },
    );
    context.roll = roll;
    if (result) {
      result.roll = roll;
      result.actionResults.push(
        buildActionResult(
          'roll',
          roll.success,
          `${roll.type}检定${roll.success ? '成功' : '失败'}（${roll.rollData}/${roll.targetData}）`,
        ),
      );
    }
  }

  applyEventEffects(selectedChoice?.effects ?? event.auto_effects, draft, bundle, context);
  draft.currentEventId = event.event_id;
  draft.currentNodeId = event.event_id;

  const shouldCompleteEvent =
    selectedChoice?.effects?.complete_event ??
    event.auto_effects?.complete_event ??
    true;

  if (shouldCompleteEvent) {
    if (!draft.completedEventIds.includes(event.event_id)) {
      draft.completedEventIds.push(event.event_id);
    }
  }

  if (event.ending?.is_ending) {
    draft.status = 'finished';
  }

  if (result) {
    result.triggeredNodeId = event.event_id;
    result.triggeredLocationId =
      event.location_binding?.location_id ?? draft.currentLocationId;
    result.triggeredOutcomeDescription = getEventPlayerText(event) || event.title;
    result.actionResults.push(
      buildActionResult(
        event.ending?.is_ending ? 'ending' : 'system',
        true,
        `${event.ending?.is_ending ? '结局触发' : '剧情推进'}：${event.title}`,
        {
          nodeId: event.event_id,
          locationId: event.location_binding?.location_id ?? draft.currentLocationId,
          effects: selectedChoice?.text ? [selectedChoice.text] : undefined,
        },
      ),
    );
    if (event.ending?.is_ending) {
      result.ending = {
        type: String(event.ending.ending_type ?? 'ending'),
        title: String(event.ending.ending_title ?? event.title),
      };
    }
  }

  context.timings.add('after_event');
  context.timings.add('on_state_changed');
}

function processTriggeredEvents(
  draft: PlayGameState,
  bundle: PlayScriptBundle,
  character: PlayCharacterProfile,
  context: EventResolutionContext,
  result?: RuleResult,
) {
  const triggeredThisPass = new Set<string>();

  for (let round = 0; round < 8; round += 1) {
    const candidates = Object.values(bundle.eventsById)
      .filter((event) => !triggeredThisPass.has(event.event_id))
      .filter((event) => event.trigger?.repeatable || !draft.completedEventIds.includes(event.event_id))
      .filter((event) =>
        (event.story_links?.conflicts_with_events ?? []).every(
          (id) => !draft.completedEventIds.includes(id),
        ),
      )
      .filter((event) =>
        (event.story_links?.requires_events ?? []).every((id) =>
          draft.completedEventIds.includes(id),
        ),
      )
      .filter((event) =>
        (event.story_links?.previous_events ?? []).every((id) =>
          draft.completedEventIds.includes(id),
        ),
      )
      .filter(
        (event) =>
          context.explicitEventIds.has(event.event_id) ||
          eventBindingMatches(event, draft, context),
      )
      .filter(
        (event) =>
          context.explicitEventIds.has(event.event_id) ||
          eventTimingMatches(event, context),
      )
      .filter(
        (event) =>
          context.explicitEventIds.has(event.event_id) ||
          eventTypeMatches(event, context),
      )
      .filter((event) =>
        evaluateConditionLogic(event.trigger?.condition_logic, draft, bundle, character, context),
      )
      .filter(
        (event) =>
          !context.explicitEventIds.has(event.event_id) ||
          eventNarrativeMatchesPlayerInput(event, context),
      )
      .sort((left, right) => sortEventCandidates(left, right, context.explicitEventIds));

    const nextEvent = candidates[0];
    if (!nextEvent) {
      break;
    }

    const selectedChoice = selectEventChoice(nextEvent, draft, bundle, character, context);
    finalizeEvent(nextEvent, selectedChoice, draft, bundle, context, result);
    context.explicitEventIds.delete(nextEvent.event_id);
    triggeredThisPass.add(nextEvent.event_id);

    if (draft.status === 'finished') {
      break;
    }
  }
}

function getCandidateEventIds(bundle: PlayScriptBundle, state: PlayGameState) {
  const currentEvent = getCurrentEvent(bundle, state);
  const locationEvents = bundle.eventsByLocationId[state.currentLocationId] ?? [];
  return uniqueStrings([
    ...(currentEvent?.story_links?.next_events ?? []),
    ...(currentEvent?.story_links?.unlocks_events ?? []),
    ...locationEvents.map((event) => event.event_id),
  ]).filter((eventId) => !state.completedEventIds.includes(eventId));
}

function buildAllowedTransitions(bundle: PlayScriptBundle, state: PlayGameState, character: PlayCharacterProfile) {
  const moves = listAttemptableConnections(bundle, state, character).map((item) => ({
    id: item.targetLocation.location_id,
    trigger: `前往 ${item.targetLocation.name}`,
  }));

  const currentEvent = getCurrentEvent(bundle, state);
  const nextEvents = uniqueStrings([
    ...(currentEvent?.story_links?.next_events ?? []),
    ...(currentEvent?.story_links?.unlocks_events ?? []),
  ])
    .filter((eventId) => !state.completedEventIds.includes(eventId))
    .map((eventId) => ({
      id: eventId,
      trigger: `推进剧情：${bundle.eventsById[eventId]?.title ?? eventId}`,
    }));

  return [...moves, ...nextEvents].slice(0, 8);
}

function buildEventObjectives(
  bundle: PlayScriptBundle,
  state: PlayGameState,
  character: PlayCharacterProfile,
) {
  const currentEvent = getCurrentEvent(bundle, state);
  const availableMoves = listAttemptableConnections(bundle, state, character)
    .map((item) => item.targetLocation.name)
    .slice(0, 3)
    .map((name) => `前往 ${name}`);

  const missingKnowledge = (bundle.scriptFile.metadata?.required_knowledge ?? [])
    .filter((knowledge) => !state.knowledge.includes(knowledge))
    .slice(0, 2)
    .map((knowledge) => `获取线索：${knowledge}`);

  const missingItems = (bundle.scriptFile.metadata?.required_items ?? [])
    .filter((itemId) => Number(state.inventory[itemId] ?? 0) <= 0)
    .slice(0, 2)
    .map((itemId) => `找到 ${getDisplayItemName(bundle, itemId)}`);

  const nextEventHints = uniqueStrings([
    ...(currentEvent?.story_links?.next_events ?? []),
    ...(currentEvent?.story_links?.unlocks_events ?? []),
  ])
    .filter((eventId) => !state.completedEventIds.includes(eventId))
    .slice(0, 2)
    .map((eventId) => `推进 ${bundle.eventsById[eventId]?.title ?? eventId}`);

  return uniqueStrings([
    getEventPlayerText(currentEvent) || (bundle.scriptFile.metadata?.story_core ?? ''),
    ...missingKnowledge,
    ...missingItems,
    ...nextEventHints,
    ...availableMoves,
  ]).slice(0, 6);
}

function buildStateDiff(previous: PlayGameState, next: PlayGameState): RuleResult['stateChanges'] {
  const inventoryAdd: Record<string, number> = {};
  const inventoryRemove: Record<string, number> = {};
  for (const itemId of uniqueStrings([
    ...Object.keys(previous.inventory),
    ...Object.keys(next.inventory),
  ])) {
    const prevCount = Number(previous.inventory[itemId] ?? 0);
    const nextCount = Number(next.inventory[itemId] ?? 0);
    if (nextCount > prevCount) {
      inventoryAdd[itemId] = nextCount - prevCount;
    } else if (nextCount < prevCount) {
      inventoryRemove[itemId] = prevCount - nextCount;
    }
  }

  const flags = Object.fromEntries(
    Object.entries(next.flags).filter(([key, value]) => previous.flags[key] !== value),
  );
  const attributes = Object.fromEntries(
    Object.entries(next.attributes).filter(([key, value]) => previous.attributes[key] !== value),
  );
  const worldState = Object.fromEntries(
    Object.entries(next.worldState).filter(([key, value]) => previous.worldState[key] !== value),
  );
  const npcStates = Object.fromEntries(
    Object.entries(next.npcStates).filter(
      ([key, value]) => JSON.stringify(previous.npcStates[key] ?? null) !== JSON.stringify(value),
    ),
  );

  return {
    inventoryAdd: Object.keys(inventoryAdd).length > 0 ? inventoryAdd : undefined,
    inventoryRemove: Object.keys(inventoryRemove).length > 0 ? inventoryRemove : undefined,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
    npcStates: Object.keys(npcStates).length > 0 ? npcStates : undefined,
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    knowledgeAdd: next.knowledge.filter((item) => !previous.knowledge.includes(item)),
    discoveredLocationIds: next.discoveredLocationIds.filter(
      (item) => !previous.discoveredLocationIds.includes(item),
    ),
    unlockedLocationIds: next.unlockedLocationIds.filter(
      (item) => !previous.unlockedLocationIds.includes(item),
    ),
    unlockedConnectionIds: next.unlockedConnectionIds.filter(
      (item) => !previous.unlockedConnectionIds.includes(item),
    ),
    blockedConnectionIds: next.blockedConnectionIds.filter(
      (item) => !previous.blockedConnectionIds.includes(item),
    ),
    completedEventIds: next.completedEventIds.filter(
      (item) => !previous.completedEventIds.includes(item),
    ),
    worldState: Object.keys(worldState).length > 0 ? worldState : undefined,
    timeDelta: next.timeValue - previous.timeValue,
    currentNodeId:
      next.currentNodeId !== previous.currentNodeId ? next.currentNodeId : undefined,
    currentEventId:
      next.currentEventId !== previous.currentEventId ? next.currentEventId : undefined,
    currentLocationId:
      next.currentLocationId !== previous.currentLocationId
        ? next.currentLocationId
        : undefined,
    status: next.status !== previous.status ? next.status : undefined,
    currentObjectives:
      JSON.stringify(next.currentObjectives) !== JSON.stringify(previous.currentObjectives)
        ? next.currentObjectives
        : undefined,
  };
}

export function isEventDrivenBundle(bundle: PlayScriptBundle) {
  return bundle.mode === 'event';
}

export function createInitialEventGameState(
  sessionId: string,
  bundle: PlayScriptBundle,
  loadoutLabels: string[] = [],
  loadoutItems: PlayLoadoutItem[] = [],
): PlayGameState {
  const schema = bundle.scriptFile.global_state_schema ?? {};
  const startLocationId =
    bundle.map.start_location_id ??
    bundle.map.locations?.[0]?.location_id ??
    '';

  const inventory: Record<string, number> = {};
  for (const label of loadoutLabels) {
    const normalizedLabel = normalizeText(label.replace(/^[^:：]+[:：]/, ''));
    for (const [itemId, item] of Object.entries(bundle.itemsById)) {
      if (normalizedLabel && normalizedLabel.includes(normalizeText(item.name))) {
        addInventoryItem(inventory, bundle, itemId);
      }
    }
  }

  for (const itemId of schema.inventory ?? []) {
    addInventoryItem(inventory, bundle, itemId);
  }

  const initialState: PlayGameState = {
    sessionId,
    scriptId: bundle.scriptId,
    currentNodeId: startLocationId,
    currentEventId: undefined,
    currentLocationId: startLocationId,
    visitedNodeIds: [],
    visitedLocationIds: startLocationId ? [startLocationId] : [],
    discoveredLocationIds: uniqueStrings([
      ...(schema.discovered_locations ?? []),
      startLocationId,
    ]),
    unlockedLocationIds: uniqueStrings([
      ...(schema.unlocked_locations ?? []),
      startLocationId,
    ]),
    unlockedConnectionIds: uniqueStrings(schema.unlocked_connections ?? []),
    blockedConnectionIds: uniqueStrings(schema.blocked_connections ?? []),
    completedEventIds: uniqueStrings(schema.completed_events ?? []),
    knowledge: uniqueStrings(schema.knowledge ?? []),
    attributes: { ...(schema.attributes ?? {}) },
    worldState: {},
    timeUnit: String(schema.time?.unit ?? 'turn'),
    timeValue: Number(schema.time?.initial_value ?? 0),
    inventory,
    loadoutLabels,
    loadoutItems,
    flags: cloneValueMap(schema.flags),
    npcStates: {},
    recentEvents: [],
    narrativeSummary: '',
    currentObjectives: [],
    turnCount: 0,
    status: 'active',
    updatedAt: Date.now(),
  };

  const context: EventResolutionContext = {
    previousLocationId: startLocationId,
    currentLocationId: startLocationId,
    timings: new Set<string>(['on_enter', 'on_location_discovered']),
    explicitEventIds: new Set<string>(
      bundle.initialEventId ? [bundle.initialEventId] : [],
    ),
    discoveredLocationIds: new Set<string>([startLocationId]),
    unlockedLocationIds: new Set<string>([startLocationId]),
    unlockedConnectionIds: new Set<string>(),
    blockedConnectionIds: new Set<string>(),
    addedItemIds: new Set<string>(),
    removedItemIds: new Set<string>(),
  };

  processTriggeredEvents(
    initialState,
    bundle,
    {
      id: '',
      name: '',
      image: '',
      info: {},
      metrics: {},
    },
    context,
  );
  initialState.currentObjectives = buildEventObjectives(
    bundle,
    initialState,
    {
      id: '',
      name: '',
      image: '',
      info: {},
      metrics: {},
    },
  );
  initialState.narrativeSummary =
    getEventPlayerText(getCurrentEvent(bundle, initialState)) ||
    `你已进入 ${bundle.locationsById[startLocationId]?.name ?? '未知地点'}。`;

  return initialState;
}

export function executeEventRule(
  playerInput: string,
  intent: ParsedIntent,
  state: PlayGameState,
  bundle: PlayScriptBundle,
  character: PlayCharacterProfile,
): RuleResult {
  const draft = cloneState(state);
  const context: EventResolutionContext = {
    previousLocationId: state.currentLocationId,
    currentLocationId: state.currentLocationId,
    timings: new Set<string>(),
    explicitEventIds: new Set<string>(),
    discoveredLocationIds: new Set<string>(),
    unlockedLocationIds: new Set<string>(),
    unlockedConnectionIds: new Set<string>(),
    blockedConnectionIds: new Set<string>(),
    addedItemIds: new Set<string>(),
    removedItemIds: new Set<string>(),
    targetNpcId: intent.targetNpcId,
    targetItemId: intent.targetItemId,
    targetItemUseRuleId: intent.targetItemUseRuleId,
    playerIntent: intent.intent,
    playerInput,
  };
  for (const eventId of intent.targetEventIds ?? []) {
    if (bundle.eventsById[eventId]) {
      context.explicitEventIds.add(eventId);
    }
  }

  const result: RuleResult = {
    success: true,
    actionType: intent.intent,
    actionResults: [],
    stateChanges: {},
    allowedNextNodes: [],
  };

  switch (intent.intent) {
    case 'move': {
      if (!intent.targetLocationId) {
        result.success = false;
        result.reason = '未识别出明确目的地';
        result.actionResults.push(
          buildActionResult('move', false, '你还没有明确要前往哪里。'),
        );
        break;
      }

      moveToLocation(
        draft,
        bundle,
        character,
        intent.targetLocationId,
        context,
        result,
      );
      break;
    }
    case 'talk_to_npc': {
      const targetNpcId = intent.targetNpcId;
      const presentNpcIds = getPresentNpcIds(bundle, draft, draft.currentLocationId);
      if (!targetNpcId || !presentNpcIds.includes(targetNpcId)) {
        result.success = false;
        result.reason = 'NPC 不在当前场景';
        result.actionResults.push(
          buildActionResult('dialogue', false, '当前没有可对话的对象回应你。'),
        );
        break;
      }

      draft.npcStates[targetNpcId] = {
        ...(draft.npcStates[targetNpcId] ?? {}),
        met: true,
        hostility: bundle.npcsById[targetNpcId]?.hostility ?? 'neutral',
        lastTopic: playerInput,
      };
      context.timings.add('on_interact');
      result.actionResults.push(
        buildActionResult(
          'dialogue',
          true,
          `你试图与 ${getDisplayNpcName(bundle, targetNpcId)} 交谈。`,
          { npcId: targetNpcId },
        ),
      );
      break;
    }
    case 'use_item': {
      const targetItemId = intent.targetItemId;
      if (!targetItemId || Number(draft.inventory[targetItemId] ?? 0) <= 0) {
        result.success = false;
        result.reason = '缺少目标物品';
        result.actionResults.push(
          buildActionResult('use_item', false, '你手上没有可以这样使用的物品。'),
        );
        break;
      }

      const item = bundle.itemsById[targetItemId];
      applyItemUsage(draft, bundle, item, character, context);
      result.actionResults.push(
        buildActionResult(
          'use_item',
          true,
          `你使用了 ${getDisplayItemName(bundle, targetItemId)}。`,
          { itemId: targetItemId },
        ),
      );
      break;
    }
    case 'inspect': {
      context.timings.add('on_search');
      const currentLocation = getCurrentLocation(bundle, draft);
      const currentItems = currentLocation.items ?? [];
      const foundItemId =
        intent.targetItemId && currentItems.includes(intent.targetItemId)
          ? intent.targetItemId
          : !intent.targetItemId && currentItems.length === 1
            ? currentItems[0]
            : undefined;

      if (foundItemId && addInventoryItem(draft.inventory, bundle, foundItemId) > 0) {
        context.addedItemIds.add(foundItemId);
        context.timings.add('on_item_acquired');
        result.actionResults.push(
          buildActionResult(
            'item_gain',
            true,
            `你发现了 ${getDisplayItemName(bundle, foundItemId)}。`,
            { itemId: foundItemId },
          ),
        );
      } else {
        result.actionResults.push(
          buildActionResult('inspect', true, '你进一步观察了周围环境。'),
        );
      }
      break;
    }
    case 'ask_world_question':
    case 'free_roleplay':
    default: {
      context.timings.add('on_interact');
      result.actionResults.push(
        buildActionResult('system', true, '你的行动暂未直接改变世界状态。'),
      );
      break;
    }
  }

  if (result.success) {
    processTriggeredEvents(draft, bundle, character, context, result);
  }

  draft.currentObjectives = buildEventObjectives(bundle, draft, character);
  result.stateChanges = buildStateDiff(state, draft);
  result.allowedNextNodes = buildAllowedTransitions(bundle, draft, character);
  return result;
}

export function applyEventRuleResult(
  state: PlayGameState,
  ruleResult: RuleResult,
  bundle: PlayScriptBundle,
): PlayGameState {
  const nextState = cloneState(state);
  normalizeInventory(nextState.inventory, bundle);

  for (const [itemId, count] of Object.entries(ruleResult.stateChanges.inventoryAdd ?? {})) {
    addInventoryItem(nextState.inventory, bundle, itemId, Number(count ?? 0));
  }

  for (const [itemId, count] of Object.entries(ruleResult.stateChanges.inventoryRemove ?? {})) {
    removeInventoryItem(nextState.inventory, itemId, Number(count ?? 0));
  }

  Object.assign(nextState.flags, ruleResult.stateChanges.flags ?? {});
  Object.assign(nextState.attributes, ruleResult.stateChanges.attributes ?? {});
  Object.assign(nextState.worldState, ruleResult.stateChanges.worldState ?? {});
  addKnowledge(nextState, ruleResult.stateChanges.knowledgeAdd ?? []);

  for (const locationId of ruleResult.stateChanges.discoveredLocationIds ?? []) {
    if (!nextState.discoveredLocationIds.includes(locationId)) {
      nextState.discoveredLocationIds.push(locationId);
    }
  }

  for (const locationId of ruleResult.stateChanges.unlockedLocationIds ?? []) {
    if (!nextState.unlockedLocationIds.includes(locationId)) {
      nextState.unlockedLocationIds.push(locationId);
    }
  }

  for (const connectionId of ruleResult.stateChanges.unlockedConnectionIds ?? []) {
    if (!nextState.unlockedConnectionIds.includes(connectionId)) {
      nextState.unlockedConnectionIds.push(connectionId);
    }
    nextState.blockedConnectionIds = nextState.blockedConnectionIds.filter(
      (id) => id !== connectionId,
    );
  }

  for (const connectionId of ruleResult.stateChanges.blockedConnectionIds ?? []) {
    if (!nextState.blockedConnectionIds.includes(connectionId)) {
      nextState.blockedConnectionIds.push(connectionId);
    }
    nextState.unlockedConnectionIds = nextState.unlockedConnectionIds.filter(
      (id) => id !== connectionId,
    );
  }

  for (const eventId of ruleResult.stateChanges.completedEventIds ?? []) {
    if (!nextState.completedEventIds.includes(eventId)) {
      nextState.completedEventIds.push(eventId);
    }
  }

  for (const [npcId, npcState] of Object.entries(ruleResult.stateChanges.npcStates ?? {})) {
    nextState.npcStates[npcId] = {
      ...(nextState.npcStates[npcId] ?? {}),
      ...npcState,
    };
  }

  if (ruleResult.stateChanges.currentLocationId) {
    nextState.currentLocationId = ruleResult.stateChanges.currentLocationId;
  }

  if (ruleResult.stateChanges.currentEventId !== undefined) {
    nextState.currentEventId = ruleResult.stateChanges.currentEventId;
  }

  if (ruleResult.stateChanges.currentNodeId) {
    nextState.currentNodeId = ruleResult.stateChanges.currentNodeId;
  }

  if (ruleResult.stateChanges.status) {
    nextState.status = ruleResult.stateChanges.status;
  }

  if (Number(ruleResult.stateChanges.timeDelta ?? 0) !== 0) {
    nextState.timeValue += Number(ruleResult.stateChanges.timeDelta ?? 0);
  }

  if (ruleResult.stateChanges.currentObjectives?.length) {
    nextState.currentObjectives = [...ruleResult.stateChanges.currentObjectives];
  }

  nextState.turnCount += 1;
  nextState.updatedAt = Date.now();

  if (
    nextState.currentLocationId &&
    !nextState.visitedLocationIds.includes(nextState.currentLocationId)
  ) {
    nextState.visitedLocationIds.push(nextState.currentLocationId);
  }

  if (nextState.currentNodeId && !nextState.visitedNodeIds.includes(nextState.currentNodeId)) {
    nextState.visitedNodeIds.push(nextState.currentNodeId);
  }

  const latestSummary =
    ruleResult.actionResults.at(-1)?.summary ??
    `位于 ${bundle.locationsById[nextState.currentLocationId]?.name ?? nextState.currentLocationId}`;
  nextState.narrativeSummary = [
    ...nextState.recentEvents.map((item) => item.summary),
    latestSummary,
  ]
    .filter(Boolean)
    .slice(-8)
    .join('；');

  return nextState;
}

export function buildEventClientSnapshot(
  bundle: PlayScriptBundle,
  state: PlayGameState,
  character: PlayCharacterProfile,
): PlayClientSnapshot {
  const currentLocation = getCurrentLocation(bundle, state);
  const currentEvent = getCurrentEvent(bundle, state);
  const inventory = normalizeInventory({ ...state.inventory }, bundle);
  const inventoryItems = Object.entries(inventory).map(([itemId, count]) => ({
    itemId,
    name: getDisplayItemName(bundle, itemId),
    count,
    description: String(bundle.itemsById[itemId]?.description ?? '').trim(),
  }));
  const availableMoveLabels = listAttemptableConnections(bundle, state, character).map(
    (item) => item.targetLocation.name,
  );
  const recentEventSummaries = state.recentEvents.map((event) => event.summary).slice(-12);

  return {
    sessionId: state.sessionId,
    scriptId: state.scriptId,
    status: state.status,
    turnCount: state.turnCount,
    currentNodeId: state.currentNodeId,
    currentNodeTitle: currentEvent?.title ?? currentLocation.name,
    currentLocationId: currentLocation.location_id,
    currentLocationName: currentLocation.name,
    currentLocationDescription:
      getEventPlayerText(currentEvent) || (currentLocation.description ?? ''),
    storySummary: state.narrativeSummary,
    overviewEntries: uniqueStrings([
      `当前位置：${currentLocation.name}`,
      currentEvent?.title ? `当前事件：${currentEvent.title}` : '',
      getEventPlayerText(currentEvent),
      ...recentEventSummaries,
    ]),
    completedNodeTitles: state.completedEventIds
      .map((eventId) => bundle.eventsById[eventId]?.title ?? '')
      .filter(Boolean)
      .reverse(),
    inventoryLabels: inventoryItems.map((item) =>
      item.count > 1 ? `${item.name} x${item.count}` : item.name,
    ),
    inventoryItems,
    loadoutLabels: [...state.loadoutLabels],
    objectiveLabels: buildEventObjectives(bundle, state, character),
    presentNpcIds: getPresentNpcIds(bundle, state, state.currentLocationId),
    presentNpcNames: getPresentNpcIds(bundle, state, state.currentLocationId).map(
      (npcId) => bundle.npcsById[npcId]?.name ?? npcId,
    ),
    availableMoveLabels,
    recentEventSummaries,
  };
}

export function buildEventWelcomeMessages(
  bundle: PlayScriptBundle,
  state: PlayGameState,
): PlayMessageRecord[] {
  const currentLocation = getCurrentLocation(bundle, state);
  const currentEvent = getCurrentEvent(bundle, state);

  return [
    {
      func: 'chat',
      message: `欢迎进入《${bundle.scriptFile.metadata?.title ?? '未命名剧本'}》。`,
      character: 'system',
    },
    {
      func: 'chat',
      message: `${currentEvent?.title ?? currentLocation.name}：${getEventPlayerText(currentEvent) || (currentLocation.description ?? '你已进入故事。')}`,
      character: 'system',
    },
  ];
}

export function buildEventOpeningPrompt(
  bundle: PlayScriptBundle,
  state: PlayGameState,
  character: PlayCharacterProfile,
) {
  const currentLocation = getCurrentLocation(bundle, state);
  const currentEvent = getCurrentEvent(bundle, state);
  const presentNpcs = getPresentNpcIds(bundle, state, state.currentLocationId)
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
      title: currentEvent?.title ?? currentLocation.name,
      description: trimPromptText(
        getEventPlayerText(currentEvent) || (currentLocation.description ?? ''),
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
      objectives: buildEventObjectives(bundle, state, character).slice(0, 4),
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

export function buildEventOpeningFallbackMessages(
  bundle: PlayScriptBundle,
  state: PlayGameState,
): PlayMessageRecord[] {
  const currentLocation = getCurrentLocation(bundle, state);
  const currentEvent = getCurrentEvent(bundle, state);
  const npcNames = getPresentNpcIds(bundle, state, state.currentLocationId)
    .map((npcId) => bundle.npcsById[npcId]?.name ?? npcId)
    .filter(Boolean)
    .slice(0, 2);
  const lead =
    trimPromptText(
      currentEvent?.description ?? currentLocation.description ?? '',
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

export function buildEventNarrationPrompt(params: {
  bundle: PlayScriptBundle;
  previousState: PlayGameState;
  state: PlayGameState;
  intent: ParsedIntent;
  playerInput: string;
  character: PlayCharacterProfile;
  recentMessages?: PlayMessageRecord[];
  ruleResult: RuleResult;
  inputMode: 'action' | 'dialogue' | 'thought';
  spokenText?: string;
  actionText?: string;
  thoughtText?: string;
}) {
  const {
    bundle,
    previousState,
    state,
    intent,
    playerInput,
    character,
    recentMessages = [],
    ruleResult,
    inputMode,
    spokenText,
    actionText,
    thoughtText,
  } = params;
  const currentLocation = getCurrentLocation(bundle, state);
  const previousLocation = getCurrentLocation(bundle, previousState);
  const currentEvent = getCurrentEvent(bundle, state);
  const previousEvent = getCurrentEvent(bundle, previousState);
  const presentNpcIds = getPresentNpcIds(bundle, state, state.currentLocationId);
  const inventoryEntries = Object.entries(state.inventory).map(([itemId, count]) => ({
    name: getDisplayItemName(bundle, itemId),
    count,
  }));

  const compactState = {
    scene: {
      location: currentLocation.name,
      event: currentEvent?.title ?? '',
      description: trimPromptText(
        getEventPlayerText(currentEvent) || (currentLocation.description ?? ''),
        220,
      ),
      narrative: getEventNarrativeDetail(currentEvent),
    },
    status: state.status,
    time: `${state.timeValue} ${state.timeUnit ?? 'turn'}`,
    attributes: state.attributes,
    inventory: inventoryEntries.slice(0, 6),
    knowledge: state.knowledge.slice(-6),
    objectives: buildEventObjectives(bundle, state, character).slice(0, 4),
    moves: buildAllowedTransitions(bundle, state, character)
      .slice(0, 4)
      .map((item) => item.trigger),
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

  const compactContext = {
    before: {
      location: previousLocation.name,
      event: previousEvent?.title ?? '',
      description: trimPromptText(
        getEventPlayerText(previousEvent) || (previousLocation.description ?? ''),
        180,
      ),
      narrative: getEventNarrativeDetail(previousEvent),
    },
    after: {
      location: currentLocation.name,
      event: currentEvent?.title ?? '',
      description: trimPromptText(
        getEventPlayerText(currentEvent) || (currentLocation.description ?? ''),
        180,
      ),
      narrative: getEventNarrativeDetail(currentEvent),
    },
    npcs: presentNpcIds.map((npcId) => ({
      npcId,
      name: bundle.npcsById[npcId]?.name ?? npcId,
      hostility: bundle.npcsById[npcId]?.hostility ?? 'neutral',
      personality: trimPromptText(bundle.npcsById[npcId]?.personality ?? '', 60),
    })),
    recent: {
      events: summarizeRecentEvents(state.recentEvents, 4),
      messages: summarizeRecentMessages(recentMessages, 4),
    },
    summary: trimPromptText(state.narrativeSummary, 180),
    responseNpcIds: presentNpcIds,
  };

  const compactInput = {
    mode: inputMode,
    text: trimPromptText(
      spokenText ?? actionText ?? thoughtText ?? playerInput,
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
    '若ctx.before/after包含narrative，生成时必须尊重其中的goal/clue/reason：只写玩家已触发的目标、线索或威胁，并让状态变化能从叙事原因中看出来。',
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

export function buildEventAiTurnPrompt(params: {
  bundle: PlayScriptBundle;
  state: PlayGameState;
  inputMode: 'action' | 'dialogue' | 'thought';
  playerInput: string;
  character: PlayCharacterProfile;
  recentMessages?: PlayMessageRecord[];
}) {
  const { bundle, state, inputMode, playerInput, character, recentMessages = [] } = params;
  const currentLocation = getCurrentLocation(bundle, state);
  const currentEvent = getCurrentEvent(bundle, state);
  const presentNpcIds = getPresentNpcIds(bundle, state, state.currentLocationId);
  const moves = listAttemptableConnections(bundle, state, character).slice(0, 8);
  const inventoryItemEntries = Object.entries(state.inventory)
    .filter(([, count]) => Number(count) > 0)
    .slice(0, 8);
  const eventCandidates = getCandidateEventIds(bundle, state)
    .map((eventId) => bundle.eventsById[eventId])
    .filter(Boolean)
    .slice(0, 8);

  return [
    '你是受控文字RPG回合引擎，只返回JSON，不要Markdown。',
    '根据玩家输入、前文、当前地点、关联地点和候选事件，生成本回合叙事，并给服务端可验证的ops。',
    'ops只允许填给定ID；不确定就留空。服务端会二次校验并执行，禁止编造地点/事件/物品/NPC。',
    '很多回合只是对话、查看、搜索、思考或原地行动，不会发生地点变化、事件触发或物品变化；这种情况 ops 保持空对象或只填 npc。',
    '只有玩家明确移动/进入/离开/前往某地点时才填 loc；只是看向、询问、描述、检查某地点时不要填 loc。',
    '只有玩家动作满足候选事件触发语义时才填 events；不要为了推进剧情强行触发事件。',
    '判定候选事件时必须结合ctx.events里的narrative：玩家输入应明显对应goal、clue或reason，才允许填该event；只提到地点名或氛围不算触发。',
    '只有明确拿起/发现可拿物才填 items_add；只是查看/搜索未找到时不要填。',
    '玩家使用物品时，必须先根据ctx.inventory.use_rules判断具体使用方法；能匹配到方法时填item_use={item,use}，不要用items_remove代替。只有明确交出、丢弃或规则要求消耗时才填items_remove。',
    'intent只能是 move/inspect/talk_to_npc/use_item/ask_world_question/free_roleplay。',
    'loc只能选ctx.moves.id；events只能选ctx.events.id最多2个；items_add只能选ctx.items.id；items_remove和item_use.item只能选ctx.inventory.id；item_use.use只能选该物品use_rules.id；npc只能选ctx.npcs.id。',
    'narration写2-4句短句，只写新发生的动作后果/地点变化/线索；npc_dialogues只能用ctx.npcs.id。',
    'schema={"intent":"string","ops":{"loc":"location_id","events":["event_id"],"items_add":["item_id"],"items_remove":["item_id"],"item_use":{"item":"item_id","use":"use_id"},"npc":"npc_id","flags":{"k":true},"status":"active|finished"},"narration":"string","npc_dialogues":[{"npcId":"npc_id","text":"string"}],"confidence":0-1}',
    stringifyPromptPayload('scene', {
      loc: {
        id: currentLocation.location_id,
        name: currentLocation.name,
        desc: trimPromptText(currentLocation.description ?? '', 100),
      },
      event: currentEvent
        ? {
            id: currentEvent.event_id,
            title: currentEvent.title,
            desc: trimPromptText(getEventPlayerText(currentEvent), 100),
            narrative: getEventNarrativeDetail(currentEvent),
          }
        : undefined,
      objectives: state.currentObjectives.slice(0, 4),
      inv: inventoryItemEntries.map(([id, count]) => ({ id, name: getDisplayItemName(bundle, id), count })),
      known: state.knowledge.slice(-6),
    }),
    stringifyPromptPayload('ctx', {
      moves: moves.map((item) => ({
        id: item.targetLocation.location_id,
        name: item.targetLocation.name,
        via: trimPromptText(item.connection.connection_type ?? '', 50),
      })),
      events: eventCandidates.map((event) => ({
        id: event.event_id,
        title: event.title,
        at: event.location_binding?.location_id ?? '',
        narrative: getEventNarrativeDetail(event),
        trig: trimPromptText(
          [
            event.trigger?.trigger_type,
            event.trigger?.trigger_timing,
            getEventSemanticText(event),
          ].filter(Boolean).join(' '),
          180,
        ),
        choices: (event.choices ?? []).slice(0, 3).map((choice) => ({
          id: choice.choice_id,
          intent: choice.choice_intent,
          text: trimPromptText(choice.text ?? '', 80),
          preview: trimPromptText(choice.result_preview ?? '', 60),
        })),
      })),
      npcs: presentNpcIds.map((npcId) => ({
        id: npcId,
        name: bundle.npcsById[npcId]?.name ?? npcId,
      })),
      items: (currentLocation.items ?? []).slice(0, 8).map((itemId) => ({
        id: itemId,
        name: getDisplayItemName(bundle, itemId),
      })),
      inventory: inventoryItemEntries.map(([itemId, count]) => {
        const item = bundle.itemsById[itemId];
        return {
          id: itemId,
          name: getDisplayItemName(bundle, itemId),
          count,
          desc: trimPromptText(item?.description ?? '', 80),
          use_rules: (item?.use_rules ?? []).slice(0, 5).map((rule) => ({
            id: rule.use_id,
            type: rule.usage_type,
            at: (rule.usable_at ?? []).slice(0, 6),
            targets: (rule.target_ids ?? []).slice(0, 6),
            desc: trimPromptText(rule.description ?? '', 100),
            effects: {
              flags: rule.effects?.set_flags ? Object.keys(rule.effects.set_flags).slice(0, 6) : undefined,
              add_items: rule.effects?.add_items?.slice(0, 4),
              remove_items: rule.effects?.remove_items?.slice(0, 4),
              knowledge: rule.effects?.add_knowledge?.slice(0, 3),
              unlock_locations: rule.effects?.unlock_locations?.slice(0, 4),
              unlock_connections: rule.effects?.unlock_connections?.slice(0, 4),
              trigger_events: rule.effects?.trigger_events?.slice(0, 4),
              consume: rule.effects?.consume_item,
            },
          })),
        };
      }),
      recent: {
        events: summarizeRecentEvents(state.recentEvents, 3, 70),
        messages: summarizeRecentMessages(recentMessages, 3, 70),
      },
    }),
    stringifyPromptPayload('input', {
      mode: inputMode,
      text: trimPromptText(playerInput, 140),
    }),
  ].join('\n');
}

export function normalizeEventAiTurnOutput(raw: string | null): AiTurnOutput | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AiTurnOutput;
    const allowedIntents = new Set<PlayerIntentType>([
      'move',
      'inspect',
      'talk_to_npc',
      'use_item',
      'ask_world_question',
      'free_roleplay',
    ]);
    const intent = allowedIntents.has(parsed.intent as PlayerIntentType)
      ? parsed.intent
      : undefined;
    const ops = parsed.ops && typeof parsed.ops === 'object' ? parsed.ops : {};

    return {
      intent,
      ops: {
        loc: String(ops.loc ?? '').trim() || undefined,
        events: Array.isArray(ops.events)
          ? ops.events.map((item) => String(item).trim()).filter(Boolean).slice(0, 2)
          : undefined,
        items_add: Array.isArray(ops.items_add)
          ? ops.items_add.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
          : undefined,
        items_remove: Array.isArray(ops.items_remove)
          ? ops.items_remove.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
          : undefined,
        item_use:
          ops.item_use && typeof ops.item_use === 'object'
            ? {
                item: String(ops.item_use.item ?? '').trim() || undefined,
                use: String(ops.item_use.use ?? '').trim() || undefined,
              }
            : undefined,
        npc: String(ops.npc ?? '').trim() || undefined,
        flags: ops.flags && typeof ops.flags === 'object' ? ops.flags : undefined,
        status: ops.status === 'finished' ? 'finished' : undefined,
      },
      narration: String(parsed.narration ?? '').trim(),
      npc_dialogues: Array.isArray(parsed.npc_dialogues)
        ? parsed.npc_dialogues
            .map((item) => ({
              npcId: String(item.npcId ?? '').trim(),
              text: String(item.text ?? '').trim(),
            }))
            .filter((item) => item.npcId && item.text)
        : [],
      confidence: Number.isFinite(Number(parsed.confidence))
        ? Math.max(0, Math.min(1, Number(parsed.confidence)))
        : 0,
    };
  } catch {
    return null;
  }
}

export function normalizeEventNarrationOutput(raw: string | null) {
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
