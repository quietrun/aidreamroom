import { useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { API } from '../utils/API';
import { images } from '../constant';
import { localStorageKey } from '../constant/localStorageKey';

function parseCharacterInfo(character) {
  if (!character) {
    return null;
  }

  try {
    return {
      ...character,
      info:
        typeof character.info === 'string'
          ? JSON.parse(character.info || '{}')
          : character.info || {},
    };
  } catch {
    return {
      ...character,
      info: {},
    };
  }
}

function buildBoardList(snapshot) {
  if (!snapshot) {
    return [[], []];
  }

  const loadoutLabels = snapshot.loadoutLabels || [];
  const inventoryItems = Array.isArray(snapshot.inventoryItems) ? snapshot.inventoryItems : [];
  const inventoryMetaByLabel = new Map(
    inventoryItems.map((item) => [
      normalizeBoardItemLabel(item.name),
      {
        description: String(item.description || '').trim(),
        count: Number(item.count || 0),
        itemId: item.itemId,
      },
    ]),
  );
  const loadoutKeys = loadoutLabels.map((item) => normalizeBoardItemLabel(item));
  const loadoutItems = loadoutLabels.map((label) => ({
    label,
    source: label.startsWith('装备:') ? '装备' : '带入',
    description:
      inventoryMetaByLabel.get(normalizeBoardItemLabel(label))?.description || '',
  }));
  const gainedItems = inventoryItems
    .filter((label) => {
      const normalized = normalizeBoardItemLabel(label.name);
      return !loadoutKeys.some((key) => key && normalized.includes(key));
    })
    .map((item) => ({
      label: item.count > 1 ? `${item.name} x${item.count}` : item.name,
      source: '剧情获取',
      description: String(item.description || '').trim(),
    }));
  const overviewLabels = Array.isArray(snapshot.completedNodeTitles)
    ? snapshot.completedNodeTitles
        .map((item) => String(item).trim())
        .filter(Boolean)
    : [];

  return [[...loadoutItems, ...gainedItems], overviewLabels];
}

function normalizeBoardItemLabel(value) {
  return String(value || '')
    .replace(/^(装备|技能卡|物品):/, '')
    .replace(/\sx\d+$/, '')
    .trim();
}

function getSocketReadyStateLabel(readyState) {
  switch (readyState) {
    case 0:
      return 'CONNECTING';
    case 1:
      return 'OPEN';
    case 2:
      return 'CLOSING';
    case 3:
      return 'CLOSED';
    default:
      return 'UNKNOWN';
  }
}

function logPlaySocket(level, eventName, payload = {}) {
  const logger = console[level] || console.log;
  logger.call(console, '[play-ws]', eventName, payload);
}

function shouldHidePlayMessage(item) {
  if (!item || item.character === 'me') {
    return false;
  }

  const text = String(item.message || '').trim();
  return (
    text.startsWith('正在 roll 点，本次校验属性为：') ||
    /^你的点数为 \d+，目标数值为 \d+，结果为：/.test(text) ||
    /^[a-zA-Z_]+ 检定 (成功|失败)（\d+\/\d+）/.test(text) ||
    text.startsWith('当前场景：')
  );
}

function normalizePlayMessage(item) {
  if (!item || item.character === 'me') {
    return item;
  }

  const text = String(item.message || '').trim();
  if (item.speaker) {
    return item;
  }

  if (item.character === 'narrator' && text.startsWith('旁白：')) {
    return {
      ...item,
      message: text.slice(3).trim(),
      speaker: '艾达 AIDR（叙述者）',
    };
  }

  if (item.character !== 'system' && item.character !== 'narrator') {
    const separatorIndex = text.indexOf('：');
    if (separatorIndex > 0) {
      return {
        ...item,
        message: text.slice(separatorIndex + 1).trim(),
        speaker: text.slice(0, separatorIndex).trim(),
      };
    }
  }

  return item;
}

function filterVisiblePlayMessages(messages) {
  return Array.isArray(messages)
    ? messages.filter((item) => !shouldHidePlayMessage(item)).map(normalizePlayMessage)
    : [];
}

function getDialogueRecordStorageKey(gameId) {
  return `${localStorageKey.PLAY_DIALOGUE_RECORDS}:${gameId}`;
}

function buildDialogueRecordId(item) {
  return [
    String(item?.character || '').trim(),
    String(item?.speaker || '').trim(),
    String(item?.message || '').trim(),
  ].join('::');
}

function readDialogueRecords(gameId) {
  if (!gameId || typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getDialogueRecordStorageKey(gameId));
    const parsed = JSON.parse(raw || '[]');

    return Array.isArray(parsed)
      ? parsed
          .map((item) => ({
            id: String(item?.id || '').trim(),
            func: item?.func === 'image' ? 'image' : 'chat',
            character: String(item?.character || '').trim(),
            speaker: String(item?.speaker || '').trim(),
            message: String(item?.message || '').trim(),
            savedAt: Number(item?.savedAt || 0),
          }))
          .filter((item) => item.id && item.character && item.message)
      : [];
  } catch {
    return [];
  }
}

function writeDialogueRecords(gameId, records) {
  if (!gameId || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(getDialogueRecordStorageKey(gameId), JSON.stringify(records));
  } catch {
    // Ignore storage failures and keep the current page usable.
  }
}

function normalizeHintMode(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (
    normalized === 'dialogue' ||
    normalized.includes('dialog') ||
    normalized.includes('speak') ||
    normalized.includes('talk') ||
    normalized.includes('对话') ||
    normalized.includes('说话')
  ) {
    return 'dialogue';
  }

  if (
    normalized === 'thought' ||
    normalized.includes('think') ||
    normalized.includes('thought') ||
    normalized.includes('思考') ||
    normalized.includes('内心')
  ) {
    return 'thought';
  }

  return 'action';
}

function unwrapJsonFence(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function parseHintOptions(raw) {
  const normalized = unwrapJsonFence(raw);

  try {
    const parsed = JSON.parse(normalized);
    const options = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.options)
        ? parsed.options
        : [];

    return options
      .map((item, index) => {
        const mode = normalizeHintMode(item?.mode);
        const content = String(item?.content ?? item?.message ?? item?.text ?? '').trim();
        const label = String(item?.label ?? item?.title ?? '').trim() || `提示 ${index + 1}`;

        if (!content) {
          return null;
        }

        return {
          id: `${mode}-${index}-${content}`,
          mode,
          label,
          content,
        };
      })
      .filter(Boolean)
      .slice(0, 3);
  } catch {
    return [];
  }
}

function buildHintPrompt(params) {
  const {
    plotInfo,
    snapshot,
    characterInfo,
    messageList,
    boardList,
    draftInput = '',
  } = params;
  const recentMessages = messageList
    .slice(-8)
    .map((item) => ({
      role: item.character === 'me' ? 'player' : 'assistant',
      speaker:
        item.character === 'me'
          ? characterInfo?.info?.name || '玩家'
          : item.speaker || item.character || '未知',
      mode: item.mode || '',
      content:
        item.func === 'image'
          ? `[图片消息] ${String(item.message || '').trim()}`
          : String(item.message || '').trim(),
    }))
    .filter((item) => item.content);
  const inventoryLabels = Array.isArray(boardList?.[0])
    ? boardList[0].map((item) => String(item?.label || item || '').trim()).filter(Boolean).slice(0, 12)
    : [];
  const completedNodes = Array.isArray(snapshot?.completedNodeTitles)
    ? snapshot.completedNodeTitles.slice(0, 10)
    : Array.isArray(boardList?.[1])
      ? boardList[1].slice(0, 10)
      : [];

  return [
    '你是文字 RPG 的游玩提示助手。',
    '你只负责根据当前剧情状态，为玩家生成 3 个下一步可直接发送的候选输入。',
    '候选输入允许是 action、dialogue、thought 任意类型，并尽量覆盖至少两种不同类型。',
    'content 必须是玩家将直接发送给游戏的一句话或一小段，不要编号，不要解释，不要加“建议：”“你可以：”之类前缀。',
    'dialogue 是玩家说出口的话；action 是动作或行为；thought 是内心判断、试探、回忆或推理，不能被 NPC 直接听见。',
    '所有选项都必须紧贴当前场景、最近对话、背包和目标，不要剧透未知信息，不要凭空新增设定，不要写已经发生后的结果。',
    '如果局势紧张，选项要更具体；如果信息不足，允许给出谨慎试探、观察或询问。',
    '请严格返回 JSON，不要使用 Markdown 代码块。',
    'Schema: {"options":[{"label":"不超过10个字","mode":"action|dialogue|thought","content":"string"}]}',
    `context=${JSON.stringify({
      plotTitle: plotInfo?.title || '',
      plotDescription: plotInfo?.descript || '',
      worldType: plotInfo?.worldType || '',
      characterName: characterInfo?.info?.name || '',
      characterProfile: characterInfo?.info || {},
      currentScene: {
        nodeTitle: snapshot?.currentNodeTitle || '',
        locationName: snapshot?.currentLocationName || '',
        locationDescription: snapshot?.currentLocationDescription || '',
      },
      objectives: snapshot?.objectiveLabels || [],
      presentNpcs: snapshot?.presentNpcNames || [],
      availableMoves: snapshot?.availableMoveLabels || [],
      inventory: inventoryLabels,
      completedNodes,
      recentMessages,
      currentDraftInput: String(draftInput || '').trim(),
    })}`,
  ].join('\n');
}

const MESSAGE_PLAYBACK_INTERVAL_MS = 2000;

export function usePlaySession({ gameId, socketUrl }) {
  const [plotInfo, setPlotInfo] = useState(null);
  const [characterInfo, setCharacterInfo] = useState(null);
  const [gameInfo, setGameInfo] = useState(null);
  const [plotItemList, setPlotItemList] = useState([]);
  const [messageList, setMessageList] = useState([]);
  const [boardList, setBoardList] = useState([[], []]);
  const [remainTimes, setRemainTimes] = useState({});
  const [remainTime, setRemainTime] = useState(0);
  const [modelList, setModelList] = useState([]);
  const [currentModuleId, setCurrentModuleId] = useState(1);
  const [currentModuleName, setCurrentModuleName] = useState('');
  const [waitingMessage, setWaitingMessage] = useState(false);
  const [waitingImage, setWaitingImage] = useState(images.img_waiting_message_1);
  const [isFinish, setIsFinish] = useState(false);
  const [dialogueRecordList, setDialogueRecordList] = useState([]);
  const [hintOptions, setHintOptions] = useState([]);
  const [hintLoading, setHintLoading] = useState(false);
  const socketRef = useRef(null);
  const waitingEventRef = useRef(null);
  const moduleIdRef = useRef(1);
  const incomingMessageQueueRef = useRef([]);
  const incomingMessageTimerRef = useRef(null);
  const lastIncomingMessageAtRef = useRef(0);
  const hasPendingResponseRef = useRef(false);
  const responseCompleteRef = useRef(false);

  useEffect(() => {
    moduleIdRef.current = currentModuleId;
  }, [currentModuleId]);

  useEffect(() => {
    setDialogueRecordList(readDialogueRecords(gameId));
  }, [gameId]);

  useEffect(() => {
    setHintOptions([]);
    setHintLoading(false);
  }, [gameId]);

  const clearIncomingMessageTimer = () => {
    if (incomingMessageTimerRef.current) {
      window.clearTimeout(incomingMessageTimerRef.current);
      incomingMessageTimerRef.current = null;
    }
  };

  const resetIncomingMessagePlayback = () => {
    clearIncomingMessageTimer();
    incomingMessageQueueRef.current = [];
    lastIncomingMessageAtRef.current = 0;
    hasPendingResponseRef.current = false;
    responseCompleteRef.current = false;
  };

  const closeWaiting = () => {
    setWaitingMessage(false);
    if (waitingEventRef.current) {
      window.clearInterval(waitingEventRef.current);
      waitingEventRef.current = null;
    }
  };

  const finalizeIncomingMessagePlayback = () => {
    if (!hasPendingResponseRef.current || !responseCompleteRef.current) {
      return;
    }

    if (incomingMessageQueueRef.current.length > 0) {
      return;
    }

    clearIncomingMessageTimer();
    hasPendingResponseRef.current = false;
    responseCompleteRef.current = false;
    lastIncomingMessageAtRef.current = 0;
    closeWaiting();
  };

  const scheduleIncomingMessagePlayback = () => {
    if (incomingMessageTimerRef.current || incomingMessageQueueRef.current.length === 0) {
      return;
    }

    const elapsed = lastIncomingMessageAtRef.current
      ? Date.now() - lastIncomingMessageAtRef.current
      : MESSAGE_PLAYBACK_INTERVAL_MS;
    const delay = Math.max(MESSAGE_PLAYBACK_INTERVAL_MS - elapsed, 0);

    incomingMessageTimerRef.current = window.setTimeout(() => {
      incomingMessageTimerRef.current = null;
      const nextMessage = incomingMessageQueueRef.current.shift();

      if (nextMessage) {
        lastIncomingMessageAtRef.current = Date.now();
        setMessageList((current) => [...current, nextMessage]);
      }

      if (incomingMessageQueueRef.current.length > 0) {
        scheduleIncomingMessagePlayback();
        return;
      }

      finalizeIncomingMessagePlayback();
    }, delay);
  };

  const enqueueIncomingMessage = (nextMessage) => {
    const normalizedMessage = normalizePlayMessage(nextMessage);
    const now = Date.now();
    const elapsed = lastIncomingMessageAtRef.current
      ? now - lastIncomingMessageAtRef.current
      : MESSAGE_PLAYBACK_INTERVAL_MS;

    if (!incomingMessageTimerRef.current && incomingMessageQueueRef.current.length === 0 && elapsed >= MESSAGE_PLAYBACK_INTERVAL_MS) {
      lastIncomingMessageAtRef.current = now;
      setMessageList((current) => [...current, normalizedMessage]);
      finalizeIncomingMessagePlayback();
      return;
    }

    incomingMessageQueueRef.current.push(normalizedMessage);
    scheduleIncomingMessagePlayback();
  };

  const markResponseComplete = () => {
    responseCompleteRef.current = true;
    finalizeIncomingMessagePlayback();
  };

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
      const [{ plot, script, character, game, runtime }, { moduleList }, { config }] =
        await Promise.all([
          API.PLAT_QUERY_INFO({ id: gameId }),
          API.PLAY_QUERY_MODULE_LIST(),
          API.PLAY_QUERY_TIMES_REMAIN(),
        ]);
      if (!mounted) {
        return;
      }

      const remainMap = {};
      (config || []).forEach((item) => {
        remainMap[item.moduleId] = item.times;
      });

      setRemainTimes(remainMap);
      setModelList(moduleList || []);
      setCurrentModuleId(game?.model_id || 1);
      const currentModule = (moduleList || []).find(
        (item) => item.moduleId === (game?.model_id || 1),
      );
      setCurrentModuleName(currentModule?.showName || '');
      setRemainTime(
        game?.model_id in remainMap ? remainMap[game.model_id] : '无限',
      );
      setGameInfo(game || null);
      setIsFinish(Boolean(game?.isFinish || runtime?.state?.status === 'finished'));
      setPlotInfo(script || plot || null);
      setCharacterInfo(parseCharacterInfo(character));
      setPlotItemList([]);
      setBoardList(buildBoardList(runtime?.snapshot));
      setHintOptions([]);
      resetIncomingMessagePlayback();
      setMessageList(filterVisiblePlayMessages(runtime?.messages || []));

      logPlaySocket('info', 'connecting', {
        gameId,
        socketUrl,
      });
      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;
      socket.onopen = () => {
        logPlaySocket('info', 'open', {
          gameId,
          socketUrl,
          readyState: getSocketReadyStateLabel(socket.readyState),
        });
        logPlaySocket('info', 'send', {
          gameId,
          func: 'connect',
        });
        socket.send(JSON.stringify({ func: 'connect', gameId }));
      };
      socket.onmessage = async (event) => {
        const response = JSON.parse(event.data);
        logPlaySocket('info', 'message', {
          gameId,
          func: response.func,
          readyState: getSocketReadyStateLabel(socket.readyState),
        });
        switch (response.func) {
          case 'chat': {
            const chatMessage = {
              message: response.message,
              character: response.character,
              speaker: response.speaker,
              mode: response.mode,
              func: 'chat',
            };
            if (shouldHidePlayMessage(chatMessage)) {
              break;
            }
            enqueueIncomingMessage(chatMessage);
            break;
          }
          case 'image': {
            enqueueIncomingMessage({
              message: response.message,
              character: response.character,
              speaker: response.speaker,
              func: 'image',
            });
            break;
          }
          case 'roll': {
            markResponseComplete();
            break;
          }
          case 'history': {
            resetIncomingMessagePlayback();
            setHintOptions([]);
            if (Array.isArray(response.messages)) {
              setMessageList(filterVisiblePlayMessages(response.messages));
            } else if (response.url) {
              const responseData = await fetch(response.url);
              const historyMessages = JSON.parse(await responseData.text());
              setMessageList(filterVisiblePlayMessages(historyMessages));
            }
            break;
          }
          case 'state': {
            setBoardList(buildBoardList(response.state));
            setIsFinish(response.state?.status === 'finished');
            setGameInfo((current) => ({
              ...(current || {}),
              snapshot: response.state,
            }));
            setHintOptions([]);
            markResponseComplete();
            break;
          }
          case 'finish': {
            message.info('您已到达该剧情的终点');
            setIsFinish(true);
            markResponseComplete();
            break;
          }
          case 'items': {
            const items = String(response.items || '')
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean);
            setBoardList((current) => {
              if (current[0]?.length) {
                return current;
              }

              return [
                items.map((label) => ({ label, source: '剧情获取', description: '' })),
                current[1] || [],
              ];
            });
            break;
          }
          case 'error': {
            message.info(response.message || '连接异常');
            if (response.refundModuleId !== undefined) {
              setRemainTime((current) => {
                if (current === '无限') {
                  return current;
                }
                const next = Number(current) + 1;
                return Number.isFinite(next) ? next : current;
              });
            }
            markResponseComplete();
            break;
          }
          default:
            break;
        }
      };
      socket.onerror = (event) => {
        logPlaySocket('error', 'error', {
          gameId,
          socketUrl,
          readyState: getSocketReadyStateLabel(socket.readyState),
          event,
        });
        markResponseComplete();
      };
      socket.onclose = (event) => {
        logPlaySocket('warn', 'close', {
          gameId,
          socketUrl,
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        markResponseComplete();
      };
      } catch (error) {
        logPlaySocket('error', 'init-failed', {
          gameId,
          socketUrl,
          error,
        });
      }
    }

    init();

    return () => {
      mounted = false;
      if (waitingEventRef.current) {
        window.clearInterval(waitingEventRef.current);
      }
      resetIncomingMessagePlayback();
      if (socketRef.current) {
        logPlaySocket('info', 'cleanup-close', {
          gameId,
          socketUrl,
          readyState: getSocketReadyStateLabel(socketRef.current.readyState),
        });
        socketRef.current.close();
      }
    };
  }, [gameId, socketUrl]);

  const showWaiting = () => {
    setWaitingMessage(true);
    let index = 1;
    setWaitingImage(images[`img_waiting_message_${index}`]);
    waitingEventRef.current = window.setInterval(() => {
      index += 1;
      if (index > 3) {
        index = 1;
      }
      setWaitingImage(images[`img_waiting_message_${index}`]);
    }, 500);
  };

  const sendMessage = (inputMessage, options = {}) => {
    const trimmed = inputMessage.trim();
    const inputMode = options.inputMode || 'action';
    if (!trimmed) {
      return false;
    }
    if (isFinish) {
      message.info('您已到达该剧情的终点');
      return false;
    }
    if (waitingMessage) {
      message.info('正在等待艾达返回，请稍后');
      return false;
    }
    // if (remainTime !== '无限' && Number(remainTime) === 0) {
    //   message.info('该模型当前已无使用次数，请明日继续');
    //   return false;
    // }
    if (!socketRef.current || socketRef.current.readyState !== 1) {
      logPlaySocket('warn', 'send-skipped', {
        gameId,
        socketUrl,
        readyState: getSocketReadyStateLabel(socketRef.current?.readyState),
        func: 'chat',
        moduleId: moduleIdRef.current,
      });
      message.info('当前连接尚未建立，请稍后重试');
      return false;
    }
    logPlaySocket('info', 'send', {
      gameId,
      func: 'chat',
      moduleId: moduleIdRef.current,
      inputMode,
      messageLength: trimmed.length,
    });
    socketRef.current.send(
      JSON.stringify({
        func: 'chat',
        message: trimmed,
        character: 'me',
        moduleId: moduleIdRef.current,
        inputMode,
      }),
    );
    setHintOptions([]);
    resetIncomingMessagePlayback();
    hasPendingResponseRef.current = true;
    setMessageList((current) => [
      ...current,
      { func: 'chat', message: trimmed, character: 'me', mode: inputMode },
    ]);
    if (remainTime !== '无限') {
      setRemainTime((current) => {
        const next = Number(current) - 1;
        return next < 0 ? 0 : next;
      });
    }
    showWaiting();
    return true;
  };

  const isDialogueRecorded = (item) => {
    const normalizedMessage = normalizePlayMessage(item);
    const recordId = buildDialogueRecordId(normalizedMessage);
    return dialogueRecordList.some((record) => record.id === recordId);
  };

  const saveDialogueRecord = (item) => {
    const normalizedMessage = normalizePlayMessage(item);
    const record = {
      id: buildDialogueRecordId(normalizedMessage),
      func: normalizedMessage.func === 'image' ? 'image' : 'chat',
      character: String(normalizedMessage.character || '').trim(),
      speaker: String(normalizedMessage.speaker || '').trim(),
      message: String(normalizedMessage.message || '').trim(),
      savedAt: Date.now(),
    };

    if (!record.id || !record.character || !record.message) {
      return;
    }

    setDialogueRecordList((current) => {
      if (current.some((item) => item.id === record.id)) {
        const nextRecords = current.filter((item) => item.id !== record.id);
        writeDialogueRecords(gameId, nextRecords);
        return nextRecords;
      }

      const nextRecords = [record, ...current].slice(0, 80);
      writeDialogueRecords(gameId, nextRecords);
      return nextRecords;
    });
  };

  const requestHintOptions = async (draftInput = '') => {
    if (hintLoading) {
      return [];
    }

    if (isFinish) {
      message.info('您已到达该剧情的终点');
      return [];
    }

    if (waitingMessage) {
      message.info('正在等待艾达返回，请稍后');
      return [];
    }

    const snapshot = gameInfo?.snapshot;
    if (!snapshot) {
      message.info('当前剧情尚未加载完成');
      return [];
    }

    setHintLoading(true);
    try {
      const prompt = buildHintPrompt({
        plotInfo,
        snapshot,
        characterInfo,
        messageList,
        boardList,
        draftInput,
      });
      const response = await API.GPT_GENERATE_MESSAGE({
        message: prompt,
        model: 'gpt-5.4',
      });
      const options = parseHintOptions(response?.message || '');

      if (!options.length) {
        throw new Error('No hint options returned');
      }

      setHintOptions(options);
      return options;
    } catch (error) {
      logPlaySocket('error', 'hint-failed', {
        gameId,
        error: error instanceof Error ? error.message : String(error),
      });
      setHintOptions([]);
      message.info('提示生成失败，请稍后重试');
      return [];
    } finally {
      setHintLoading(false);
    }
  };

  const sendHintOption = (option) => {
    if (!option?.content) {
      return false;
    }

    const sent = sendMessage(option.content, {
      inputMode: normalizeHintMode(option.mode),
    });

    if (sent) {
      setHintOptions([]);
    }

    return sent;
  };

  return {
    plotInfo,
    characterInfo,
    gameInfo,
    plotItemList,
    messageList,
    boardList,
    remainTimes,
    remainTime,
    modelList,
    currentModuleId,
    setCurrentModuleId,
    currentModuleName,
    waitingMessage,
    waitingImage,
    isFinish,
    dialogueRecordList,
    isDialogueRecorded,
    saveDialogueRecord,
    hintOptions,
    hintLoading,
    requestHintOptions,
    sendHintOption,
    sendMessage,
  };
}
