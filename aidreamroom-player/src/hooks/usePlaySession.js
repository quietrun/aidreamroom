import { useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { API } from '../utils/API';
import { images } from '../constant';

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
      const { plot, character, game, plotList } = await API.PLAT_QUERY_INFO({ id: gameId });
      const { moduleList } = await API.PLAY_QUERY_MODULE_LIST();
      const { config } = await API.PLAY_QUERY_TIMES_REMAIN();
      if (!mounted) {
        return;
      }
      const remainMap = {};
      config.forEach((item) => {
        remainMap[item.moduleId] = item.times;
      });
      setRemainTimes(remainMap);
      setModelList(moduleList);
      setCurrentModuleId(game.model_id);
      const currentModule = moduleList.find((item) => item.moduleId === game.model_id);
      setCurrentModuleName(currentModule?.showName || '');
      setRemainTime(game.model_id in remainMap ? remainMap[game.model_id] : '无限');
      setGameInfo(game);
      setIsFinish(Boolean(game.isFinish));
      setPlotInfo(plot);
      setCharacterInfo({ ...character, info: JSON.parse(character.info) });
      setBoardList([game.currentItems?.split(',') || [], [plot.plotTarget || '随意探索']]);
      setPlotItemList(plotList || []);

      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;
      socket.onopen = () => {
        socket.send(JSON.stringify({ func: 'connect', gameId }));
      };
      socket.onmessage = async (event) => {
        const response = JSON.parse(event.data);
        switch (response.func) {
          case 'chat': {
            setMessageList((current) => [...current, { message: response.message, character: response.character, func: 'chat' }]);
            closeWaiting();
            break;
          }
          case 'image': {
            setMessageList((current) => [...current, { message: response.message, character: response.character, func: 'image' }]);
            closeWaiting();
            break;
          }
          case 'roll': {
            const data = response.data;
            setMessageList((current) => [
              ...current,
              { message: `正在roll点，本次校验的属性为：${data.metricsInfo?.name}`, character: 'system', func: 'chat' },
              { message: `您的点数为${data.rollData}, 目标数值为${data.targetData},结果为：${data.rollData >= data.targetData ? '成功' : '失败'}`, character: 'system', func: 'chat' },
            ]);
            closeWaiting();
            break;
          }
          case 'history': {
            const responseData = await fetch(response.url);
            const historyMessages = JSON.parse(await responseData.text());
            setMessageList((current) => [...historyMessages, ...current]);
            break;
          }
          case 'finish': {
            message.info('您已到达该剧情的终点');
            setIsFinish(true);
            closeWaiting();
            break;
          }
          case 'items': {
            setBoardList((current) => [response.items.split(','), current[1] || []]);
            break;
          }
          default:
            break;
        }
      };
      socket.onerror = () => {
        closeWaiting();
      };
    }

    init();

    return () => {
      mounted = false;
      if (waitingEventRef.current) {
        window.clearInterval(waitingEventRef.current);
      }
      if (socketRef.current) {
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
    socketRef.current?.send(JSON.stringify({ func: 'chat', message: trimmed, character: 'me', moduleId: moduleIdRef.current }));
    setMessageList((current) => [...current, { func: 'chat', message: trimmed, character: 'me' }]);
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
