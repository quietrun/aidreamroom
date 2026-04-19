import { useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { API } from '../utils/API';
import { images } from '../constant';

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

  return [snapshot.inventoryLabels || [], snapshot.objectiveLabels || []];
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
  const socketRef = useRef(null);
  const waitingEventRef = useRef(null);
  const moduleIdRef = useRef(1);

  useEffect(() => {
    moduleIdRef.current = currentModuleId;
  }, [currentModuleId]);

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
      setMessageList(runtime?.messages || []);

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
            setMessageList((current) => [
              ...current,
              {
                message: response.message,
                character: response.character,
                func: 'chat',
              },
            ]);
            closeWaiting();
            break;
          }
          case 'image': {
            setMessageList((current) => [
              ...current,
              {
                message: response.message,
                character: response.character,
                func: 'image',
              },
            ]);
            closeWaiting();
            break;
          }
          case 'roll': {
            const data = response.data || {};
            setMessageList((current) => [
              ...current,
              {
                message: `正在 roll 点，本次校验属性为：${data.type || '未知属性'}`,
                character: 'system',
                func: 'chat',
              },
              {
                message: `你的点数为 ${data.rollData}，目标数值为 ${data.targetData}，结果为：${data.rollData <= data.targetData ? '成功' : '失败'}`,
                character: 'system',
                func: 'chat',
              },
            ]);
            closeWaiting();
            break;
          }
          case 'history': {
            if (Array.isArray(response.messages)) {
              setMessageList(response.messages);
            } else if (response.url) {
              const responseData = await fetch(response.url);
              const historyMessages = JSON.parse(await responseData.text());
              setMessageList(historyMessages);
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
            break;
          }
          case 'finish': {
            message.info('您已到达该剧情的终点');
            setIsFinish(true);
            closeWaiting();
            break;
          }
          case 'items': {
            const items = String(response.items || '')
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean);
            setBoardList((current) => [items, current[1] || []]);
            break;
          }
          case 'error': {
            message.info(response.message || '连接异常');
            closeWaiting();
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
        closeWaiting();
      };
      socket.onclose = (event) => {
        logPlaySocket('warn', 'close', {
          gameId,
          socketUrl,
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        closeWaiting();
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

  const closeWaiting = () => {
    setWaitingMessage(false);
    if (waitingEventRef.current) {
      window.clearInterval(waitingEventRef.current);
      waitingEventRef.current = null;
    }
  };

  const sendMessage = (inputMessage) => {
    const trimmed = inputMessage.trim();
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
    if (remainTime !== '无限' && Number(remainTime) === 0) {
      message.info('该模型当前已无使用次数，请明日继续');
      return false;
    }
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
      messageLength: trimmed.length,
    });
    socketRef.current.send(
      JSON.stringify({
        func: 'chat',
        message: trimmed,
        character: 'me',
        moduleId: moduleIdRef.current,
      }),
    );
    setMessageList((current) => [
      ...current,
      { func: 'chat', message: trimmed, character: 'me' },
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
    sendMessage,
  };
}
