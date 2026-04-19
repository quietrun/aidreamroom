export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ValueMap = Record<string, string | number | boolean>;

export type RawMapFile = {
  metadata?: {
    title?: string;
    description?: string;
    total_locations?: number;
    floors?: string[];
  };
  start_location_id?: string;
  locations?: RawLocation[];
};

export type RawLocation = {
  location_id: string;
  name: string;
  description?: string;
  floor?: string;
  danger_level?: string;
  connections?: RawLocationConnection[];
  npcs?: string[];
  items?: string[];
  events?: string[];
};

export type RawLocationConnection = {
  target_location_id: string;
  connection_type?: string;
  bidirectional?: boolean;
  locked?: boolean;
  lock_condition?: RawCondition;
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
  interactions?: Array<{
    type?: string;
    result?: string;
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

export type RawItem = {
  item_id: string;
  name: string;
  type?: string;
  description?: string;
  rarity?: string;
  weight?: number;
  stackable?: boolean;
  effects?: Array<{
    effect_type?: string;
    target?: string;
  }>;
  uses?: number;
  spawn_locations?: string[];
  dropped_by?: string[];
  required_for?: string[];
};

export type RawScriptFile = {
  metadata?: {
    title?: string;
    description?: string;
    total_nodes?: number;
    theme?: string;
    difficulty?: string;
    required_items?: string[];
    required_knowledge?: string[];
  };
  nodes?: RawScriptNode[];
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

export type RawCondition = {
  type?: string;
  name?: string;
  operator?: string;
  value?: JsonValue;
};

export type RawOutcomeCondition = RawCondition & {
  roll_success?: boolean;
  is_ending?: boolean;
  ending_type?: string;
  ending_title?: string;
};

export type PlayScriptRecord = {
  uuid: string;
  metadata: {
    title: string;
    description: string;
    totalNodes: number;
    theme: string;
    difficulty: string;
    requiredItems: string[];
    requiredKnowledge: string[];
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
  map: RawMapFile;
  npcFile: RawNpcFile;
  itemFile: RawItemFile;
  scriptFile: RawScriptFile;
  locationsById: Record<string, RawLocation>;
  nodesById: Record<string, RawScriptNode>;
  nodesByLocationId: Record<string, RawScriptNode[]>;
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
  currentLocationId: string;
  visitedNodeIds: string[];
  visitedLocationIds: string[];
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
    currentNodeId?: string;
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
  inventoryLabels: string[];
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
};
