export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ValueMap = Record<string, string | number | boolean>;

export type RawCondition = {
  type?: string;
  name?: string;
  operator?: string;
  value?: JsonValue;
};

export type RawConditionLogic = {
  operator?: string;
  conditions?: RawCondition[];
  groups?: RawConditionLogic[];
};

export type RawMapFile = {
  metadata?: {
    title?: string;
    description?: string;
    total_locations?: number;
    floors?: string[];
    map_design_note?: string;
    location_trigger_design_note?: string;
  };
  start_location_id?: string;
  locations?: RawLocation[];
};

export type RawMethodRollCheck = {
  required?: boolean;
  roll_type?: string;
  difficulty?: string;
  success_effects?: string[];
  failure_effects?: string[];
};

export type RawMethodNpcInteraction = {
  required?: boolean;
  npc_id?: string | null;
  interaction_type?: string;
  success_flag?: string | null;
};

export type RawMethodEffectSet = {
  discover_location?: boolean;
  unlock_location?: boolean;
  unlock_connection?: boolean;
  remain_locked?: boolean;
  blocked?: boolean;
  set_flags?: ValueMap;
  modify_attributes?: Record<string, number>;
  advance_time?: number;
  trigger_events?: string[];
};

export type RawLocationAccessMethod = {
  method_id?: string;
  method_type?: string;
  description?: string;
  condition_logic?: RawConditionLogic;
  roll_check?: RawMethodRollCheck;
  npc_interaction?: RawMethodNpcInteraction;
  effects?: RawMethodEffectSet;
  success_effects?: RawMethodEffectSet;
  failure_effects?: RawMethodEffectSet;
  fallback_method_ids?: string[];
};

export type RawConnectionTraversalControl = {
  default_traversable?: boolean;
  unlock_methods?: RawLocationAccessMethod[];
  deadlock_safety?: {
    required_for_mainline?: boolean;
    min_available_methods?: number;
    fallback_method_ids?: string[];
    prerequisite_source_ids?: string[];
    anti_deadlock_note?: string;
  };
};

export type RawLocationConnection = {
  connection_id?: string;
  target_location_id: string;
  connection_type?: string;
  bidirectional?: boolean;
  locked?: boolean;
  lock_condition?: RawCondition;
  traversal_control?: RawConnectionTraversalControl;
};

export type RawLocationEventHook = {
  hook_id?: string;
  hook_type?: string;
  description?: string;
  recommended_trigger_types?: string[];
};

export type RawLocation = {
  location_id: string;
  name: string;
  description?: string;
  floor?: string;
  danger_level?: string;
  tags?: string[];
  access_control?: {
    visible_by_default?: boolean;
    reachable_by_default?: boolean;
    discovery_condition_logic?: RawConditionLogic;
    entry_condition_logic?: RawConditionLogic;
    entry_methods?: RawLocationAccessMethod[];
    deadlock_safety?: {
      required_for_mainline?: boolean;
      min_available_methods?: number;
      fallback_method_ids?: string[];
      prerequisite_source_ids?: string[];
      anti_deadlock_note?: string;
    };
  };
  connections?: RawLocationConnection[];
  npcs?: string[];
  items?: string[];
  events?: string[];
  event_hooks?: RawLocationEventHook[];
};

export type RawNpcFile = {
  metadata?: {
    title?: string;
    description?: string;
    total_npcs?: number;
  };
  characters?: RawNpc[];
};

export type RawNpc = {
  npc_id: string;
  name: string;
  type?: string;
  description?: string;
  personality?: string | null;
  danger_level?: string;
  hostility?: string;
  spawn_locations?: string[];
  related_event_roles?: string[];
  interactions?: Array<{
    type?: string;
    result?: string;
    may_trigger_event?: boolean;
  }>;
  drops?: string[];
  special_abilities?: string[];
  weakness?: string[];
  lore?: string;
};

export type RawItemFile = {
  metadata?: {
    title?: string;
    description?: string;
    total_items?: number;
  };
  objects?: RawItem[];
};

export type RawItemEffect = {
  effect_type?: string;
  target?: string;
  value?: JsonValue;
};

export type RawItem = {
  item_id: string;
  name: string;
  type?: string;
  description?: string;
  rarity?: string;
  weight?: number;
  stackable?: boolean;
  effects?: RawItemEffect[];
  uses?: number;
  spawn_locations?: string[];
  dropped_by?: string[];
  required_for?: string[];
  may_trigger_events?: string[];
};

export type RawGlobalStateSchema = {
  time?: {
    unit?: string;
    initial_value?: number;
  };
  attributes?: Record<string, number>;
  flags?: ValueMap;
  knowledge?: string[];
  visited_locations?: string[];
  discovered_locations?: string[];
  unlocked_locations?: string[];
  unlocked_connections?: string[];
  blocked_connections?: string[];
  completed_events?: string[];
  inventory?: string[];
};

export type RawEventEffects = {
  set_flags?: ValueMap;
  add_items?: string[];
  remove_items?: string[];
  modify_attributes?: Record<string, number>;
  add_knowledge?: string[];
  discover_locations?: string[];
  unlock_locations?: string[];
  unlock_connections?: string[];
  lock_connections?: string[];
  spawn_npcs?: string[];
  despawn_npcs?: string[];
  advance_time?: number;
  set_state?: ValueMap;
  complete_event?: boolean;
};

export type RawEventChoice = {
  choice_id?: string;
  text?: string;
  condition_logic?: RawConditionLogic;
  effects?: RawEventEffects;
  next_event_hints?: string[];
};

export type RawScriptEvent = {
  event_id: string;
  title: string;
  event_type?: string;
  story_stage?: string;
  sequence_index?: number;
  description?: string;
  location_binding?: {
    scope?: string;
    location_id?: string | null;
    location_ids?: string[];
    hook_id?: string | null;
  };
  trigger?: {
    trigger_scope?: string;
    trigger_type?: string;
    trigger_timing?: string;
    repeatable?: boolean;
    priority?: number;
    cooldown?: number;
    condition_logic?: RawConditionLogic;
  };
  roll_check?: RawMethodRollCheck;
  choices?: RawEventChoice[];
  auto_effects?: RawEventEffects;
  related_entities?: {
    locations?: string[];
    npcs?: string[];
    items?: string[];
    location_entry_methods?: string[];
    connection_unlock_methods?: string[];
  };
  story_links?: {
    previous_events?: string[];
    next_events?: string[];
    unlocks_events?: string[];
    foreshadows_events?: string[];
    requires_events?: string[];
    conflicts_with_events?: string[];
  };
  ending?: {
    is_ending?: boolean;
    ending_type?: string;
    ending_title?: string | null;
    ending_description?: string | null;
    solution_quality?: string;
  };
};

export type RawScriptFile = {
  metadata?: {
    title?: string;
    description?: string;
    total_nodes?: number;
    total_events?: number;
    theme?: string;
    difficulty?: string;
    poster?: string;
    cover?: string;
    image?: string;
    initial_event_id?: string | null;
    ending_event_ids?: string[];
    mainline_event_ids?: string[];
    side_event_ids?: string[];
    required_items?: string[];
    required_knowledge?: string[];
    story_core?: string;
  };
  global_state_schema?: RawGlobalStateSchema;
  nodes?: RawScriptNode[];
  events?: RawScriptEvent[];
};

export type RawScriptNode = {
  node_id: string;
  location_id?: string;
  title: string;
  description?: string;
  roll_required?: boolean;
  roll_type?: string;
  roll_difficulty?: string;
  conditions?: RawCondition[];
  outcomes?: RawOutcome[];
};

export type RawOutcome = {
  description?: string;
  next_node?: string;
  target_location_id?: string;
  items_gained?: string[];
  npcs_encountered?: string[];
  condition?: RawOutcomeCondition;
};

export type RawOutcomeCondition = RawCondition & {
  roll_success?: boolean;
  is_ending?: boolean;
  ending_type?: string;
  ending_title?: string;
};

export type PlayScriptRecord = {
  uuid: string;
  poster?: string;
  metadata: {
    title: string;
    description: string;
    totalNodes: number;
    totalEvents?: number;
    theme: string;
    difficulty: string;
    requiredItems: string[];
    requiredKnowledge: string[];
    storyCore?: string;
    poster?: string;
  };
  scriptFile?: string;
  npcFile?: string;
  itemFile?: string;
  mapFile?: string;
  createTime?: number;
  updateTime?: number;
};

export type PlayCharacterProfile = {
  id: string;
  name: string;
  image: string;
  info: Record<string, unknown>;
  metrics: Record<string, number>;
};

export type PlayScriptBundle = {
  scriptId: string;
  mode: 'legacy_node' | 'event';
  initialEventId?: string;
  map: RawMapFile;
  npcFile: RawNpcFile;
  itemFile: RawItemFile;
  scriptFile: RawScriptFile;
  locationsById: Record<string, RawLocation>;
  nodesById: Record<string, RawScriptNode>;
  nodesByLocationId: Record<string, RawScriptNode[]>;
  eventsById: Record<string, RawScriptEvent>;
  eventsByLocationId: Record<string, RawScriptEvent[]>;
  globalEvents: RawScriptEvent[];
  connectionsById: Record<string, RawLocationConnection>;
  npcsById: Record<string, RawNpc>;
  itemsById: Record<string, RawItem>;
  locationAliases: Record<string, string>;
  npcAliases: Record<string, string>;
  itemAliases: Record<string, string>;
};

export type PlayEventType =
  | 'move'
  | 'dialogue'
  | 'inspect'
  | 'use_item'
  | 'item_gain'
  | 'item_loss'
  | 'system'
  | 'roll'
  | 'ending';

export type PlayGameEvent = {
  turn: number;
  type: PlayEventType;
  summary: string;
  relatedNodeIds?: string[];
  relatedNpcIds?: string[];
  relatedItemIds?: string[];
  stateChanges?: Record<string, JsonValue>;
};

export type PlayGameState = {
  sessionId: string;
  scriptId: string;
  currentNodeId: string;
  currentEventId?: string;
  currentLocationId: string;
  visitedNodeIds: string[];
  visitedLocationIds: string[];
  discoveredLocationIds: string[];
  unlockedLocationIds: string[];
  unlockedConnectionIds: string[];
  blockedConnectionIds: string[];
  completedEventIds: string[];
  knowledge: string[];
  attributes: Record<string, number>;
  worldState: ValueMap;
  timeUnit?: string;
  timeValue: number;
  inventory: Record<string, number>;
  loadoutLabels: string[];
  flags: ValueMap;
  npcStates: Record<
    string,
    {
      met?: boolean;
      hostility?: string;
      lastTopic?: string;
      custom?: Record<string, JsonValue>;
    }
  >;
  recentEvents: PlayGameEvent[];
  narrativeSummary: string;
  currentObjectives: string[];
  turnCount: number;
  lastResponseId?: string;
  status: 'active' | 'finished';
  updatedAt: number;
};

export type PlayerIntentType =
  | 'move'
  | 'inspect'
  | 'talk_to_npc'
  | 'use_item'
  | 'ask_world_question'
  | 'free_roleplay'
  | 'invalid_or_ambiguous';

export type ParsedIntent = {
  intent: PlayerIntentType;
  targetLocationId?: string;
  targetNodeId?: string;
  targetNpcId?: string;
  targetItemId?: string;
  topic?: string;
  confidence: number;
  rawText: string;
};

export type PlayerInputMode = 'action' | 'dialogue' | 'thought';

export type PlayerInputAnalysis = {
  mode: PlayerInputMode;
  spokenText?: string;
  actionText?: string;
  thoughtText?: string;
  addresseeNpcId?: string;
};

export type PlayRollResult = {
  type: string;
  difficulty: string;
  rollData: number;
  targetData: number;
  success: boolean;
};

export type RuleActionResult = {
  type: string;
  success: boolean;
  summary: string;
  npcId?: string;
  itemId?: string;
  nodeId?: string;
  locationId?: string;
  effects?: string[];
};

export type RuleResult = {
  success: boolean;
  actionType: string;
  reason?: string;
  actionResults: RuleActionResult[];
  stateChanges: {
    inventoryAdd?: Record<string, number>;
    inventoryRemove?: Record<string, number>;
    flags?: ValueMap;
    npcStates?: PlayGameState['npcStates'];
    attributes?: Record<string, number>;
    knowledgeAdd?: string[];
    discoveredLocationIds?: string[];
    unlockedLocationIds?: string[];
    unlockedConnectionIds?: string[];
    blockedConnectionIds?: string[];
    completedEventIds?: string[];
    worldState?: ValueMap;
    timeDelta?: number;
    currentNodeId?: string;
    currentEventId?: string;
    currentLocationId?: string;
    status?: PlayGameState['status'];
    currentObjectives?: string[];
  };
  allowedNextNodes: Array<{
    id: string;
    trigger: string;
  }>;
  triggeredNodeId?: string;
  triggeredLocationId?: string;
  triggeredOutcomeDescription?: string;
  ending?: {
    type: string;
    title: string;
  };
  roll?: PlayRollResult;
};

export type NarrationOutput = {
  narration: string;
  npc_dialogues: Array<{
    npcId: string;
    text: string;
  }>;
  feedback?: string;
  ui_hints?: string[];
};

export type PlayClientSnapshot = {
  sessionId: string;
  scriptId: string;
  status: PlayGameState['status'];
  turnCount: number;
  currentNodeId: string;
  currentNodeTitle: string;
  currentLocationId: string;
  currentLocationName: string;
  currentLocationDescription: string;
  storySummary: string;
  overviewEntries: string[];
  completedNodeTitles: string[];
  inventoryLabels: string[];
  inventoryItems: Array<{
    itemId: string;
    name: string;
    count: number;
    description: string;
  }>;
  loadoutLabels: string[];
  objectiveLabels: string[];
  presentNpcNames: string[];
  availableMoveLabels: string[];
  recentEventSummaries: string[];
};

export type RuntimeRow = {
  session_id: string;
  script_id: string;
  state_json: string;
  message_log_json: string | null;
  created_at: number | bigint | null;
  updated_at: number | bigint | null;
};

export type PlayMessageRecord = {
  func: 'chat' | 'image';
  message: string;
  character: string;
  speaker?: string;
  mode?: PlayerInputMode | 'speech' | 'narration';
};
