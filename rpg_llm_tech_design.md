# 基于 OpenAI SDK 的文字 RPG 对话引擎技术方案

## 1. 文档概述

### 1.1 背景

当前项目已经具备 4 个 JSON 文件作为文字 RPG 游戏的核心内容源，这 4 个 JSON 承载了游戏世界的主要可玩信息，包括但不限于：

- 节点与剧情推进关系
- 后续节点条件与分支
- 物品定义与用途
- 地图与区域信息
- NPC 信息与行为约束
- 固定世界观事实

玩家的游玩方式不是点击选项，而是直接与大模型进行自然语言对话。大模型需要根据：

- 前文游玩过程
- 当前所在节点
- 可到达的后续节点
- 已获得或已消耗的物品
- 当前地图位置
- 场景中的 NPC
- 已知事实与规则限制

生成符合当前上下文的：

- 旁白
- NPC 对话
- 行为结果反馈
- 合法性校验提示
- 节奏引导与氛围渲染

项目目标并不是简单地把 4 个 JSON 原样发给模型，而是在保证**剧情不跑偏、状态不丢失、内容贴合原始 JSON、成本可控**的前提下，设计一套适用于 OpenAI SDK 的完整运行方案。

---

### 1.2 目标

本方案需要同时满足以下目标：

1. **强一致性**
   - 模型输出必须贴合 4 个 JSON 的设定
   - 不允许虚构不存在的节点、物品、NPC、地图、规则
   - 不允许跳过前置条件直接推进剧情

2. **高连贯性**
   - 长对话过程中保持叙事风格稳定
   - 记住玩家做过的关键行为
   - 记住 NPC 态度、背包、地图位置、世界变化

3. **低 Token 消耗**
   - 不每轮全量喂入 4 个 JSON
   - 不保留完整长篇历史对话
   - 使用结构化状态与摘要替代原文回放

4. **高可控性**
   - 游戏规则由程序掌控
   - 模型负责受控生成文案，而不是自由改写世界
   - 可以在服务端对模型结果进行二次校验

5. **易于工程落地**
   - 基于 OpenAI SDK 可以直接接入
   - 支持逐步迭代
   - 支持未来扩展更多剧本、更多地图、更多系统玩法

---

### 1.3 设计原则

本方案遵循以下原则：

- **程序掌控状态，模型掌控表达**
- **结构化状态优先于自然语言历史**
- **局部检索优先于全量上下文拼接**
- **规则执行优先于模型自由判断**
- **摘要优先于全文回放**
- **白名单约束优先于开放式剧情推演**

---

## 2. 总体设计思路

### 2.1 核心思想

对于文字 RPG 场景，最容易失败的方案是：

> 每轮把历史聊天和 4 个 JSON 全量发给模型，让模型自己理解、记忆、判断、推进剧情。

该方案会带来以下问题：

- token 消耗巨大
- 历史越长，噪声越多
- 模型会遗漏条件
- 模型会创造不存在的内容
- 背包、地图、NPC 关系容易混乱
- 难以做确定性校验

因此本项目应采用如下思路：

> **4 个 JSON 作为权威内容源，程序维护游戏状态与规则执行，模型仅根据程序提供的合法结果生成自然语言叙事。**

换句话说：

- **程序负责“世界真相”**
- **模型负责“把真相写得像游戏”**

---

### 2.2 整体架构

系统整体可以分为 5 层：

1. **静态内容层**
   - 4 个 JSON
   - 剧情节点、物品、NPC、地图、固定 lore

2. **内容索引层**
   - 把原始 JSON 预处理为可检索、可压缩的结构
   - 支持按节点、物品、NPC、地图做快速召回

3. **运行时状态层**
   - 维护玩家背包、地图位置、节点进度、世界 flag、NPC 态度等真实状态

4. **规则执行层**
   - 对玩家输入做意图识别
   - 做条件判断、物品消耗、节点切换、事件落库
   - 生成合法结果

5. **叙事生成层**
   - 使用 OpenAI SDK 调用模型
   - 基于当前状态、检索结果、规则执行结果生成旁白与对话

---

### 2.3 核心职责划分

| 模块 | 职责 |
|---|---|
| 原始 JSON | 游戏唯一权威内容源 |
| 索引模块 | 将静态内容整理成轻量可检索结构 |
| State 模块 | 保存当前真实游玩状态 |
| Rule Engine | 判断玩家操作是否合法，并决定状态变化 |
| LLM | 生成氛围化叙事、NPC 台词、失败反馈 |
| Validator | 校验模型输出是否违背权威状态 |
| Summary 模块 | 压缩长期历史，降低 token 成本 |

---

## 3. 静态内容建模方案

### 3.1 原始 JSON 的角色定位

4 个 JSON 是游戏世界的“内容数据库”，但不应被当作每轮提示词的一部分直接透传给模型。

正确做法是：

- 原始 JSON 只作为离线构建和实时查询的数据源
- 在线阶段只取与当前回合相关的最小内容片段

也就是说：

- **全量 JSON 存磁盘或数据库**
- **在线 prompt 只注入当前必要切片**

---

### 3.2 推荐拆分后的静态索引结构

建议对 4 个 JSON 做一次预处理，拆成以下索引文件或表：

- `nodes.compact.json`
- `edges.compact.json`
- `items.compact.json`
- `npcs.compact.json`
- `maps.compact.json`
- `lore.compact.json`
- `aliases.compact.json`
- `embeddings.index.json`（可选）

其中：

#### 3.2.1 节点索引 NodeIndex

每个节点建议压缩为：

```ts
export type GameNode = {
  id: string;
  title: string;
  summary: string;
  sceneText?: string;
  mapId?: string;
  npcIds: string[];
  itemIds: string[];
  interactableIds: string[];
  enterConditions: Condition[];
  exits: NodeExit[];
  tags: string[];
  canonFacts: string[];
  styleHints?: string[];
  fullRef?: string;
};
```

字段说明：

- `summary`：该节点的压缩描述，在线高频使用
- `sceneText`：长原文，仅在需要时取出
- `canonFacts`：该节点不可违背的事实
- `exits`：该节点可去往的后续节点及条件
- `styleHints`：写作风格提示

---

#### 3.2.2 边索引 EdgeIndex

用于控制节点推进：

```ts
export type NodeExit = {
  id: string;
  toNodeId: string;
  triggerType: 'move' | 'talk' | 'inspect' | 'use_item' | 'event';
  conditions: Condition[];
  resultSummary: string;
  hidden?: boolean;
};
```

该结构用于：

- 判断某个出口是否可达
- 判断玩家行为能否推进到新节点
- 生成 `allowedNextNodes`

---

#### 3.2.3 物品索引 ItemIndex

```ts
export type GameItem = {
  id: string;
  name: string;
  aliases?: string[];
  summary: string;
  usableOn?: string[];
  gainConditions?: Condition[];
  consumeRules?: Condition[];
  tags?: string[];
  canonFacts?: string[];
  fullRef?: string;
};
```

物品既要支持：

- 玩家自然语言提及
- 程序逻辑判断用途
- 文案层面做合理反馈

因此建议保留：

- 同义词 `aliases`
- 可使用目标 `usableOn`
- 使用限制 `consumeRules`

---

#### 3.2.4 NPC 索引 NpcIndex

```ts
export type GameNpc = {
  id: string;
  name: string;
  aliases?: string[];
  summary: string;
  persona: string[];
  speechStyle: string[];
  knowledgeFacts: string[];
  behaviorRules: string[];
  initialState?: Record<string, any>;
  fullRef?: string;
};
```

注意这里不要把 NPC 原文全量常驻，而是提炼成：

- 人设特征
- 说话风格
- 知道哪些事
- 不会做什么
- 与玩家的动态关系状态

---

#### 3.2.5 地图索引 MapIndex

```ts
export type GameMap = {
  id: string;
  name: string;
  summary: string;
  regionDescriptions?: string[];
  nodeIds: string[];
  travelRules?: string[];
  fullRef?: string;
};
```

地图索引主要用于：

- 给模型提供位置感
- 做区域可达性判断
- 控制节点之间是否可直接移动

---

#### 3.2.6 固定世界观 LoreIndex

```ts
export type LoreFact = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  fullText?: string;
};
```

用于存放：

- 固定设定
- 不可违背的世界观常识
- 阶段性真相
- 某些谜题背景

---

### 3.3 离线预处理目标

预处理时建议完成以下工作：

1. 提取每个节点的短摘要
2. 为每个节点生成关键词
3. 补全物品、NPC、地点别名
4. 建立节点与地图、NPC、物品的关系表
5. 为每个节点构建邻接边索引
6. 提炼 canon facts
7. 对长文本建立 `fullRef`
8. 可选：对摘要建立 embedding

这样运行时即可做到：

- 快速召回
- 最小上下文拼接
- 不必重复传输长文本

---

## 4. 运行时状态设计

### 4.1 为什么连贯性必须依赖状态而不是聊天历史

长对话里的真正连贯性，来源不是“保留完整聊天记录”，而是“关键状态不丢”。

对于文字 RPG 来说，最重要的是：

- 当前在哪
- 来过哪
- 拿过什么
- 用掉了什么
- 哪些门开了
- 哪些秘密已知
- 哪些 NPC 已见过
- 哪些 NPC 敌对/信任
- 哪些剧情分支已触发

如果这些信息只是散落在自然语言历史里，那么随着轮次增加：

- token 消耗会越来越大
- 召回不完整
- 模型容易混乱

因此必须由程序维护一个结构化 `GameState`。

---

### 4.2 推荐的 GameState 结构

```ts
export type GameState = {
  sessionId: string;
  chapterId?: string;
  currentNodeId: string;
  currentMapId: string;
  visitedNodeIds: string[];
  inventory: Record<string, number>;
  flags: Record<string, boolean | number | string>;
  npcStates: Record<string, {
    met?: boolean;
    alive?: boolean;
    hostile?: boolean;
    favor?: number;
    trust?: number;
    lastTopic?: string;
    custom?: Record<string, any>;
  }>;
  worldStates: Record<string, any>;
  questStates: Record<string, any>;
  recentEvents: GameEvent[];
  narrativeSummary: string;
  turnCount: number;
  lastResponseId?: string;
  updatedAt: number;
};
```

---

### 4.3 recentEvents 的意义

近期记忆不应保存完整旁白，而应保存结构化事件：

```ts
export type GameEvent = {
  turn: number;
  type:
    | 'move'
    | 'dialogue'
    | 'inspect'
    | 'use_item'
    | 'item_gain'
    | 'item_loss'
    | 'clue_found'
    | 'battle'
    | 'system';
  summary: string;
  relatedNodeIds?: string[];
  relatedNpcIds?: string[];
  relatedItemIds?: string[];
  stateChanges?: Record<string, any>;
};
```

最近 6~12 条事件就足以支撑模型理解“刚刚发生了什么”。

---

### 4.4 narrativeSummary 的意义

当回合数增加时，不能一直保留大量 recentEvents，否则 prompt 也会变胖。

因此需要一个中期剧情摘要，例如：

> 玩家已探索前厅、储藏室与东走廊；获得生锈钥匙和半张地图；守卫对玩家保持警惕但尚未敌对；已知礼拜堂可能通往地下设施，但入口未确认。

这段摘要可以周期性更新，用来替代更久远的详细事件。

---

## 5. 记忆与 Token 控制方案

### 5.1 三层记忆模型

建议采用“三层记忆模型”：

#### L1：硬状态记忆
始终携带，体积小但权威最高：

- current node
- current map
- inventory
- flags
- present npcs
- allowed next nodes
- 当前交互对象

#### L2：近期事件记忆
保留最近 6~12 条结构化事件摘要，用于保持近期连贯性。

#### L3：中期剧情摘要
每 10~20 回合，或在章节切换时压缩一次，用来替代更老的历史记录。

---

### 5.2 为什么不建议保留完整历史对话

完整历史对话的问题在于：

1. 原文冗长，信息密度低
2. 同一事实可能被重复表达多次
3. 情绪化和氛围化文字占 token 多
4. 很多内容对当前回合无用
5. 轮次一长就严重增大成本

所以建议：

- 原始回复留数据库
- prompt 中只放摘要化的历史

---

### 5.3 摘要触发策略

建议在以下时机触发摘要：

- 回合数达到阈值，如 10 回合、20 回合
- 当前 prompt token 预估接近预算上限
- 玩家切换地图
- 进入重大剧情节点
- 连续事件过多导致 recentEvents 超长

---

### 5.4 摘要内容建议

摘要不要写成普通流水账，而是围绕以下维度：

- 已探索区域
- 已见 NPC 与关系变化
- 已取得关键物品
- 已知线索
- 已触发的重要世界变化
- 当前主要目标
- 尚未解决的问题

---

### 5.5 上下文最小化原则

每轮传给模型的内容应遵循最小化原则：

#### 必带
- authoritative state
- 当前节点摘要
- 当前节点 exits 摘要
- 当前节点在场 NPC 摘要
- 当前地图摘要
- recentEvents 摘要
- narrativeSummary
- ruleResult

#### 条件带
- 玩家提到的物品
- 玩家提到的 NPC
- 与当前行为相关的 lore
- 即将进入的候选节点摘要

#### 不常驻
- 整章原文
- 全地图内容
- 所有物品详情
- 所有 NPC 全文
- 完整聊天记录

---

## 6. 回合运行主流程设计

### 6.1 总体流程

每一轮的正确执行顺序应为：

1. 接收玩家自然语言输入
2. 解析玩家意图
3. 检索当前必要上下文
4. 运行规则引擎
5. 生成合法结果
6. 调用模型进行叙事化表达
7. 对模型输出做二次校验
8. 更新状态并记录事件
9. 必要时生成新摘要

---

### 6.2 流程图

```text
玩家输入
  -> 意图识别
  -> 内容检索
  -> 规则执行
  -> 生成合法结果
  -> 大模型叙事生成
  -> 输出校验
  -> 更新 GameState
  -> 记录事件 / 更新摘要
```

---

### 6.3 推荐伪代码

```ts
export async function runTurn(playerInput: string, gameState: GameState) {
  const intent = await parseIntent(playerInput, gameState);

  const retrieved = retrieveContext({
    playerInput,
    intent,
    gameState,
  });

  const ruleResult = executeGameRules({
    playerInput,
    intent,
    gameState,
    retrieved,
  });

  const promptPayload = buildNarrationPayload({
    playerInput,
    gameState,
    retrieved,
    ruleResult,
  });

  const llmOutput = await generateNarration(promptPayload, gameState.lastResponseId);

  validateNarration(llmOutput, gameState, retrieved, ruleResult);

  const nextState = applyStateChanges(gameState, ruleResult);

  appendGameEvent(nextState, playerInput, ruleResult, llmOutput);

  maybeRefreshSummary(nextState);

  return {
    output: llmOutput,
    nextState,
  };
}
```

---

## 7. 玩家输入解析方案

### 7.1 为什么需要意图解析

玩家输入是自然语言，可能非常自由，例如：

- “我走到门口，把那把旧钥匙插进去试试。”
- “我不理他，先检查墙上的画。”
- “我问守卫地下室在哪里。”
- “把刚刚拿到的纸片拿给神父看。”
- “我想去东边那条走廊。”

程序不能直接拿原文做规则判断，需要先归类出意图。

---

### 7.2 推荐意图类型

```ts
export type PlayerIntentType =
  | 'move'
  | 'inspect'
  | 'talk_to_npc'
  | 'use_item'
  | 'ask_world_question'
  | 'free_roleplay'
  | 'meta_question'
  | 'invalid_or_ambiguous';
```

---

### 7.3 意图解析结果结构

```ts
export type ParsedIntent = {
  intent: PlayerIntentType;
  targetNodeId?: string;
  targetNpcId?: string;
  targetItemId?: string;
  targetObjectId?: string;
  topic?: string;
  confidence: number;
  rawText: string;
};
```

---

### 7.4 推荐实现方式

建议采用两段式：

#### 方案 A：规则 + 轻模型
- 先用规则和 alias 匹配识别物品、NPC、地点
- 再用轻量模型输出结构化意图

#### 方案 B：单模型结构化输出
- 直接让模型根据当前节点上下文输出意图 JSON

对于可控性和成本的平衡，建议：

- 先规则匹配实体
- 再用模型补足动作语义

---

## 8. 内容检索与上下文拼接方案

### 8.1 检索目标

检索层的目标不是“找全”，而是“找刚好够用”。

每轮只召回：

- 当前节点
- 当前节点邻接边
- 当前节点在场 NPC
- 玩家提及的物品
- 当前地图简述
- 最近相关 lore
- 必要时的下一节点摘要

---

### 8.2 检索输入

```ts
export type RetrievalInput = {
  playerInput: string;
  intent: ParsedIntent;
  currentNodeId: string;
  currentMapId: string;
  inventory: Record<string, number>;
  flags: Record<string, any>;
  recentEvents: GameEvent[];
};
```

---

### 8.3 检索策略

#### 8.3.1 确定性召回
优先直接拿：

- 当前节点
- 当前节点边
- 当前节点 NPC
- 当前地图

#### 8.3.2 实体命中召回
如果玩家提到：

- 物品
- NPC
- 地点
- 某个已知关键词

则追加召回相应索引项。

#### 8.3.3 语义召回（可选）
如果剧本很大，允许使用 embedding 对以下内容做召回：

- lore
- 历史节点摘要
- 复杂线索说明

但必须限制数量，避免 prompt 变大。

---

### 8.4 输出给模型的上下文结构

```ts
export type RetrievedContext = {
  currentNode: GameNode;
  currentMap?: GameMap;
  presentNpcs: GameNpc[];
  relatedItems: GameItem[];
  candidateExits: NodeExit[];
  relatedLore: LoreFact[];
  recentEvents: GameEvent[];
};
```

---

## 9. 规则引擎设计

### 9.1 规则引擎的定位

规则引擎是整个系统的核心防线。它决定：

- 玩家行为是否合法
- 是否满足节点切换条件
- 物品能否使用
- NPC 会不会回应
- 状态如何变化
- 下一步允许去哪里

这部分必须由程序完成，而不能交给模型自由推断。

---

### 9.2 规则执行输入

```ts
export type RuleEngineInput = {
  playerInput: string;
  intent: ParsedIntent;
  gameState: GameState;
  retrieved: RetrievedContext;
};
```

---

### 9.3 规则执行输出

```ts
export type RuleResult = {
  success: boolean;
  actionType: string;
  reason?: string;
  actionResults: Array<{
    type: string;
    success: boolean;
    summary: string;
    npcId?: string;
    itemId?: string;
    nodeId?: string;
    effects?: string[];
  }>;
  stateChanges: {
    inventoryAdd?: Record<string, number>;
    inventoryRemove?: Record<string, number>;
    flags?: Record<string, any>;
    npcStates?: Record<string, any>;
    currentNodeId?: string;
    currentMapId?: string;
  };
  allowedNextNodes: Array<{
    id: string;
    trigger: string;
  }>;
};
```

---

### 9.4 典型规则场景

#### 9.4.1 移动
玩家说“我去东走廊”。

规则引擎需要判断：

- 当前节点是否存在通往东走廊的边
- 条件是否满足
- 是否被锁住
- 是否需要某个事件已触发

#### 9.4.2 使用物品
玩家说“我用钥匙开门”。

规则引擎需要判断：

- 玩家是否持有该钥匙
- 当前场景是否存在该门
- 钥匙是否能作用于这扇门
- 是否应消耗物品
- 是否产生新 flag

#### 9.4.3 与 NPC 对话
玩家说“我问守卫地下室在哪”。

规则引擎需要判断：

- 守卫是否在场
- 玩家是否见过守卫
- 当前 trust / hostility 如何
- 守卫是否知道地下室
- 守卫是否愿意说

#### 9.4.4 调查与观察
玩家说“我检查墙上的画”。

规则引擎需要判断：

- 当前场景是否存在“画”这个可交互对象
- 是否已经调查过
- 是否可触发线索发现
- 是否影响后续谜题

---

## 10. 模型生成层设计

### 10.1 模型的正确定位

模型不是：

- 规则引擎
- 存档系统
- 剧情白盒决策器

模型是：

- 叙事器
- 氛围化输出器
- NPC 台词生成器
- 合法结果解释器

也就是说：

- 程序先决定发生了什么
- 模型再把“发生的结果”写出来

---

### 10.2 给模型的数据应分为两类

#### 10.2.1 authoritative_state
权威状态，不允许违背：

```json
{
  "currentNodeId": "chapel_hall",
  "currentMapId": "church",
  "inventory": {"rusty_key": 1},
  "flags": {"east_door_unlocked": true},
  "presentNpcs": ["guard_01"],
  "allowedNextNodes": ["east_corridor", "stay_in_chapel"],
  "forbiddenFacts": [
    "玩家尚未进入地下室",
    "玩家尚未见过 priest_02"
  ]
}
```

#### 10.2.2 flavor_context
可用于写作润色，但不能推翻权威状态：

```json
{
  "nodeSummary": "礼拜堂空旷、潮湿，空气里带着陈旧的香灰味。",
  "npcSummary": "守卫年迈、警惕，说话简短且倾向回避敏感话题。",
  "mapSummary": "礼拜堂位于教会主体区域，东侧通向较少使用的走廊。",
  "mood": "压抑、不安、宗教气息浓重"
}
```

---

### 10.3 输出结构建议

推荐使用 JSON 结构化输出：

```json
{
  "narration": "你走近守卫时，他的目光先落在你手中的钥匙上，又很快移开。礼拜堂里一时只有蜡烛轻微的噼啪声。",
  "npc_dialogues": [
    {
      "npcId": "guard_01",
      "text": "地下？这里没有你该去的地方。别再问了。"
    }
  ],
  "feedback": "守卫没有正面回答，但他的回避反应说明他知道些什么。",
  "ui_hints": [
    "继续追问守卫",
    "转而检查礼拜堂东侧区域",
    "使用其他线索旁敲侧击"
  ]
}
```

这样做的好处：

- 前端方便渲染
- 服务端方便校验
- 容易做 AB 测试与日志分析
- 更适合二次加工

---

### 10.4 提示词职责边界

系统提示应明确以下要求：

1. 你是受控的 RPG 叙事引擎
2. 必须严格服从 authoritative_state
3. 不得创造不存在的物品、节点、NPC、地点
4. 不得修改世界状态
5. 不得使玩家跳转到白名单之外的节点
6. 可以补充氛围，但不得改写事实
7. 如果玩家行为失败，要写出符合当前设定的失败反馈

---

## 11. OpenAI SDK 接入方案

### 11.1 接入目标

OpenAI SDK 在本方案中的职责是：

- 接收本地已裁剪后的上下文
- 输出结构化叙事结果
- 在多轮中维持一定语气连续性

但它不应成为游戏状态的唯一记忆来源。

---

### 11.2 推荐调用层设计

建议封装一个 `NarrationService`：

```ts
export type NarrationRequest = {
  systemRules: string;
  authoritativeState: Record<string, any>;
  playerInput: string;
  retrievedContext: RetrievedContext;
  ruleResult: RuleResult;
  recentSummary: string;
  outputSchema: Record<string, any>;
  previousResponseId?: string;
};
```

```ts
export type NarrationResponse = {
  responseId: string;
  narration: string;
  npcDialogues: Array<{ npcId: string; text: string }>;
  feedback?: string;
  uiHints?: string[];
};
```

---

### 11.3 推荐交互方式

建议服务端每轮：

1. 读取 `gameState.lastResponseId`
2. 构建最小 prompt payload
3. 使用 OpenAI SDK 发起请求
4. 得到结构化输出
5. 存储新的 `responseId`

但要注意：

- `previous_response_id` 可以增强连续性
- 不能依赖它来保存游戏真状态
- 真状态仍由本地 `GameState` 维护

---

### 11.4 建议的工程封装

建议将调用层拆为：

- `buildNarrationPrompt.ts`
- `callOpenAI.ts`
- `validateNarration.ts`
- `applyStateChanges.ts`
- `summarizeHistory.ts`

这样后续更换模型或调 prompt 都更容易。

---

## 12. 输出校验与防跑偏设计

### 12.1 为什么必须校验

即使 prompt 已经很严格，模型仍然可能：

- 提到不存在的道具
- 说出不存在的地图
- 让 NPC 说出超出知识范围的话
- 把未来节点当成已发生事实
- 错误地描述玩家获得/失去物品

因此必须在服务端进行二次校验。

---

### 12.2 校验维度

建议校验以下内容：

1. **实体合法性**
   - 输出里提到的物品/NPC/节点/地图是否存在

2. **状态一致性**
   - 是否违背当前 inventory、flags、npcStates

3. **节点推进合法性**
   - 是否越过 `allowedNextNodes`

4. **NPC 知识边界**
   - NPC 是否说出了自己不应知道的内容

5. **剧情先后顺序**
   - 是否把未发生事件叙述为已发生

6. **风格限制**
   - 是否与当前剧本氛围相违背

---

### 12.3 校验结果处理策略

#### 轻微问题
例如：

- 多写了一句不影响世界状态的渲染描述

处理方式：

- 可直接容忍
- 或做文本清洗

#### 中度问题
例如：

- NPC 台词略微越界

处理方式：

- 触发二次修正生成

#### 严重问题
例如：

- 生成了不存在的道具
- 错误推进节点
- 改变背包状态

处理方式：

- 丢弃该次结果
- 回退为模板化兜底文本

---

### 12.4 推荐兜底方案

当模型输出不可用时，程序应有兜底模板：

- 通用失败文案
- 通用观察文案
- 通用移动文案
- 通用对话失败文案

即使模型异常，也不影响游戏继续运行。

---

## 13. 成本优化方案

### 13.1 主要成本来源

成本通常来自：

- 系统 prompt 太长
- 每轮带过多历史
- 每轮带过多节点/物品/NPC 全文
- 输出过长
- 重复注入固定规则

---

### 13.2 优化策略总览

#### 1）固定规则前缀稳定化
将：

- 系统规则
- 输出 schema
- 风格规范

尽量做成固定、可复用的前缀，便于缓存命中。

#### 2）状态结构化
用 `GameState` 替代长历史。

#### 3）摘要替代全文
用 `narrativeSummary + recentEvents` 替代原始对话。

#### 4）局部召回
只带当前节点与邻接节点，不带全图内容。

#### 5）实体压缩
NPC、物品、地图尽量只传摘要，不传长原文。

#### 6）控制输出长度
输出只要求：

- 一段旁白
- 少量 NPC 台词
- 一段反馈
- 若干提示

避免无限扩写。

---

### 13.3 推荐的单轮上下文预算

可参考如下预算思路：

- 系统规则：固定
- authoritative_state：小
- 当前节点摘要：小
- exits 与 interactables：小
- 当前 NPC 摘要：小
- 当前地图摘要：小
- recentEvents：中小
- narrativeSummary：中小
- ruleResult：小
- 玩家输入：小

整体应尽量保持在“只够当前回合”的水平，而不是“回忆整个剧本”。

---

## 14. 数据存储与服务端设计

### 14.1 推荐存储内容

每个会话建议持久化：

- `GameState`
- 原始玩家输入
- 模型输出
- 结构化 `RuleResult`
- recentEvents
- narrativeSummary
- responseId
- 时间戳

---

### 14.2 推荐表设计（示意）

#### `game_session`
- `session_id`
- `user_id`
- `story_id`
- `current_node_id`
- `current_map_id`
- `turn_count`
- `narrative_summary`
- `last_response_id`
- `updated_at`

#### `game_state_snapshot`
- `session_id`
- `inventory_json`
- `flags_json`
- `npc_states_json`
- `world_states_json`
- `quest_states_json`
- `visited_nodes_json`

#### `game_turn_log`
- `session_id`
- `turn`
- `player_input`
- `parsed_intent_json`
- `rule_result_json`
- `llm_output_json`
- `created_at`

#### `game_event_log`
- `session_id`
- `turn`
- `event_type`
- `summary`
- `payload_json`

---

## 15. 关键模块划分建议

建议代码层面按以下目录组织：

```text
src/
  story/
    loader/
      loadStoryFiles.ts
      buildCompactIndexes.ts
    retrieval/
      retrieveContext.ts
      resolveAliases.ts
      rankContext.ts
    rule-engine/
      parseIntent.ts
      executeGameRules.ts
      applyStateChanges.ts
      validators.ts
    memory/
      appendEvent.ts
      summarizeHistory.ts
      buildRecentSummary.ts
    llm/
      buildNarrationPrompt.ts
      callOpenAI.ts
      validateNarration.ts
      fallbackNarration.ts
    session/
      getSession.ts
      saveSession.ts
      saveTurnLog.ts
    types/
      game.ts
      node.ts
      item.ts
      npc.ts
      map.ts
```

---

## 16. 推荐的最小可落地版本（MVP）

### 16.1 第一阶段

先做最小可运行版本：

1. 4 个 JSON 预处理为 compact 索引
2. 支持单存档 `GameState`
3. 支持 4 类意图：
   - move
   - inspect
   - talk_to_npc
   - use_item
4. 支持 recentEvents
5. 支持固定 narrativeSummary
6. 主模型只输出：
   - narration
   - npc_dialogues
   - feedback

### 16.2 第二阶段

继续增强：

1. 加入语义检索 lore
2. 加入 NPC 信任值和敌意系统
3. 加入章节摘要刷新
4. 加入输出校验器
5. 加入失败兜底模板

### 16.3 第三阶段

进一步优化：

1. 多剧本支持
2. 多玩家并发
3. prompt 实验平台
4. 数据埋点分析
5. 质量评分与自动回放测试

---

## 17. 风险与应对

### 17.1 风险：模型自由发挥过多

应对：

- 强 authoritative_state
- 输出白名单约束
- 服务端二次校验

### 17.2 风险：长线剧情遗忘

应对：

- 结构化状态
- recentEvents
- narrativeSummary
- 关键线索单独存 flag

### 17.3 风险：token 成本升高

应对：

- 只做局部检索
- 摘要替代历史
- 实体摘要替代原文
- 控制输出长度

### 17.4 风险：意图识别错误

应对：

- 规则优先匹配实体
- 不确定时输出 `invalid_or_ambiguous`
- 给模型失败反馈而不是硬推进剧情

### 17.5 风险：规则与文案脱节

应对：

- 明确 `ruleResult` 作为文案依据
- 文案后置校验
- 建立模板兜底

---

## 18. 最终方案结论

本项目最优解不是“让模型背下整个剧本”，而是构建一套：

- **静态内容索引化**
- **运行时状态结构化**
- **局部上下文检索**
- **程序规则先执行**
- **模型受控生成文案**
- **服务端二次校验**
- **摘要化记忆压缩**

组成的文字 RPG 对话引擎。

该方案的本质是：

> 用程序保证世界一致性，用模型提升叙事表现力。

这样可以同时实现：

1. 对 4 个 JSON 的强贴合
2. 长回合对话中的连续性
3. 较低的 token 消耗
4. 可落地的 OpenAI SDK 接入方式
5. 后续可扩展、可维护、可调优的工程架构

---

## 19. 附录：推荐的关键数据结构汇总

### 19.1 GameState

```ts
export type GameState = {
  sessionId: string;
  chapterId?: string;
  currentNodeId: string;
  currentMapId: string;
  visitedNodeIds: string[];
  inventory: Record<string, number>;
  flags: Record<string, boolean | number | string>;
  npcStates: Record<string, {
    met?: boolean;
    alive?: boolean;
    hostile?: boolean;
    favor?: number;
    trust?: number;
    lastTopic?: string;
    custom?: Record<string, any>;
  }>;
  worldStates: Record<string, any>;
  questStates: Record<string, any>;
  recentEvents: GameEvent[];
  narrativeSummary: string;
  turnCount: number;
  lastResponseId?: string;
  updatedAt: number;
};
```

### 19.2 GameEvent

```ts
export type GameEvent = {
  turn: number;
  type:
    | 'move'
    | 'dialogue'
    | 'inspect'
    | 'use_item'
    | 'item_gain'
    | 'item_loss'
    | 'clue_found'
    | 'battle'
    | 'system';
  summary: string;
  relatedNodeIds?: string[];
  relatedNpcIds?: string[];
  relatedItemIds?: string[];
  stateChanges?: Record<string, any>;
};
```

### 19.3 ParsedIntent

```ts
export type ParsedIntent = {
  intent:
    | 'move'
    | 'inspect'
    | 'talk_to_npc'
    | 'use_item'
    | 'ask_world_question'
    | 'free_roleplay'
    | 'meta_question'
    | 'invalid_or_ambiguous';
  targetNodeId?: string;
  targetNpcId?: string;
  targetItemId?: string;
  targetObjectId?: string;
  topic?: string;
  confidence: number;
  rawText: string;
};
```

### 19.4 RuleResult

```ts
export type RuleResult = {
  success: boolean;
  actionType: string;
  reason?: string;
  actionResults: Array<{
    type: string;
    success: boolean;
    summary: string;
    npcId?: string;
    itemId?: string;
    nodeId?: string;
    effects?: string[];
  }>;
  stateChanges: {
    inventoryAdd?: Record<string, number>;
    inventoryRemove?: Record<string, number>;
    flags?: Record<string, any>;
    npcStates?: Record<string, any>;
    currentNodeId?: string;
    currentMapId?: string;
  };
  allowedNextNodes: Array<{
    id: string;
    trigger: string;
  }>;
};
```

### 19.5 LLM 输出结构

```ts
export type NarrationOutput = {
  narration: string;
  npc_dialogues: Array<{
    npcId: string;
    text: string;
  }>;
  feedback?: string;
  ui_hints?: string[];
};
```

---

## 20. 建议的下一步实施顺序

建议按以下顺序推进开发：

1. 先把 4 个 JSON 做 compact 化预处理
2. 定义统一的 `GameState` 与 `RuleResult`
3. 完成 `parseIntent + retrieveContext + executeGameRules`
4. 再接 OpenAI SDK 做叙事输出
5. 接入输出校验器与兜底模板
6. 最后增加摘要压缩与埋点分析

这样可以最快拿到一条稳定、可扩展、成本可控的对话型文字 RPG 主链路。
