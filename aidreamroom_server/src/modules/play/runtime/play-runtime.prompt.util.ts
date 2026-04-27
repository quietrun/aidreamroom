import {
  NarrationOutput,
  PlayGameEvent,
  PlayMessageRecord,
  RuleResult,
} from './play-runtime.types';

export function trimPromptText(value: unknown, maxLength = 180) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

export function compactPromptValue(value: unknown): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => compactPromptValue(item))
      .filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, compactPromptValue(item)] as const)
      .filter(([, item]) => item !== undefined);

    if (entries.length === 0) {
      return undefined;
    }

    return Object.fromEntries(entries);
  }

  return value;
}

export function summarizeRecentMessages(
  messages: PlayMessageRecord[],
  limit = 4,
  maxLength = 120,
) {
  return (
    compactPromptValue(
      messages.slice(-limit).map((message) => ({
        speaker: message.speaker ?? message.character,
        mode: message.mode ?? '',
        text: trimPromptText(message.message, maxLength),
      })),
    ) ?? []
  );
}

export function summarizeRecentEvents(
  events: PlayGameEvent[],
  limit = 4,
  maxLength = 100,
) {
  return (
    compactPromptValue(
      events.slice(-limit).map((event) => trimPromptText(event.summary, maxLength)),
    ) ?? []
  );
}

export function summarizeRuleResultForPrompt(
  ruleResult: RuleResult,
  actionLimit = 5,
) {
  return compactPromptValue({
    success: ruleResult.success,
    reason: trimPromptText(ruleResult.reason ?? '', 80),
    actions: ruleResult.actionResults.slice(0, actionLimit).map((action) => ({
      type: action.type,
      ok: action.success,
      text: trimPromptText(action.summary, 90),
      npcId: action.npcId,
      itemId: action.itemId,
      locationId: action.locationId,
    })),
    delta: {
      currentNodeId: ruleResult.stateChanges.currentNodeId,
      currentEventId: ruleResult.stateChanges.currentEventId,
      currentLocationId: ruleResult.stateChanges.currentLocationId,
      inventoryAdd: ruleResult.stateChanges.inventoryAdd,
      inventoryRemove: ruleResult.stateChanges.inventoryRemove,
      flags: ruleResult.stateChanges.flags
        ? Object.keys(ruleResult.stateChanges.flags).slice(0, 8)
        : undefined,
      attributes: ruleResult.stateChanges.attributes,
      knowledgeAdd: ruleResult.stateChanges.knowledgeAdd?.slice(0, 6),
      timeDelta: ruleResult.stateChanges.timeDelta,
      status: ruleResult.stateChanges.status,
    },
    ending: ruleResult.ending,
  });
}

export function stringifyPromptPayload(label: string, value: unknown) {
  return `${label}=${JSON.stringify(compactPromptValue(value) ?? {})}`;
}

function normalizeRepeatKey(value: string) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\s\r\n\t`~!@#$%^&*()_\-+=[\]{}\\|;:'"，。、《》？?！、：；;、,.]/g, '');
}

function splitTextUnits(value: string) {
  const units =
    String(value ?? '')
      .match(/[^。！？!?；;\n]+[。！？!?；;]?/g)
      ?.map((item) => item.trim())
      .filter(Boolean) ?? [];

  if (units.length > 0) {
    return units;
  }

  const fallback = String(value ?? '').trim();
  return fallback ? [fallback] : [];
}

function isRepeatedUnit(unit: string, seenKeys: string[]) {
  const current = normalizeRepeatKey(unit);
  if (!current) {
    return true;
  }

  return seenKeys.some((item) => {
    if (!item) {
      return false;
    }
    if (item === current) {
      return true;
    }
    if (current.length >= 12 && item.includes(current)) {
      return true;
    }
    if (item.length >= 12 && current.includes(item)) {
      return true;
    }
    return false;
  });
}

export function dedupeTextAgainstRecent(
  text: string,
  recentTexts: string[],
  maxUnits = 4,
) {
  const selfUniqueUnits: string[] = [];
  for (const unit of splitTextUnits(text)) {
    if (
      isRepeatedUnit(
        unit,
        selfUniqueUnits.map((item) => normalizeRepeatKey(item)),
      )
    ) {
      continue;
    }
    selfUniqueUnits.push(unit);
  }

  const seenKeys = recentTexts.flatMap((item) =>
    splitTextUnits(item).map((unit) => normalizeRepeatKey(unit)),
  );
  const keptUnits: string[] = [];

  for (const unit of selfUniqueUnits) {
    if (isRepeatedUnit(unit, [...seenKeys, ...keptUnits.map((item) => normalizeRepeatKey(item))])) {
      continue;
    }
    keptUnits.push(unit);
    if (keptUnits.length >= maxUnits) {
      break;
    }
  }

  if (keptUnits.length === 0) {
    return recentTexts.length > 0 ? '' : selfUniqueUnits[0] ?? '';
  }

  return keptUnits.join('');
}

export function sanitizeNarrationOutputContent(
  output: NarrationOutput,
  recentMessages: PlayMessageRecord[],
): NarrationOutput {
  const assistantMessages = recentMessages.filter((message) => message.character !== 'me');
  const narratorHistory = assistantMessages
    .filter((message) => message.mode === 'narration' || message.character === 'narrator')
    .slice(-3)
    .map((message) => message.message);

  const narration = dedupeTextAgainstRecent(output.narration, narratorHistory, 4);
  const seenNpcIds = new Set<string>();
  const npc_dialogues = output.npc_dialogues
    .map((dialogue) => {
      const npcHistory = assistantMessages
        .filter((message) => message.character === dialogue.npcId)
        .slice(-2)
        .map((message) => message.message);
      const text = dedupeTextAgainstRecent(dialogue.text, npcHistory, 2);
      return {
        npcId: dialogue.npcId,
        text,
      };
    })
    .filter((dialogue) => dialogue.text.trim())
    .filter((dialogue) => {
      if (seenNpcIds.has(dialogue.npcId)) {
        return false;
      }
      seenNpcIds.add(dialogue.npcId);
      return true;
    });

  return {
    ...output,
    narration,
    npc_dialogues,
  };
}
