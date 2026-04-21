import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import '../../styles/index.scss';
import { firstLogin, helpDialogConfig, images } from '../../constant';
import { HelpDialog } from '../../components/common/HelpDialog';
import { LeftChatMessage, LeftImageMessage, RightChatMessage, ImageLightbox } from '../../components/play/ChatParts';
import { usePlaySession } from '../../hooks/usePlaySession';
import iconSystemModel from '@/icon_system_model.png';

function getLeftSpeakerName(item) {
  if (item.speaker) {
    return item.speaker;
  }

  if (item.character === 'narrator') {
    return '艾达 AIDR（叙述者）';
  }

  return '艾达 AIDR';
}

const backpackTabs = [
  { key: 'prop', label: '道具' },
  { key: 'plot', label: '剧情物品' },
  { key: 'skill', label: '技能' },
];

function getBackpackItemLabel(item) {
  return String(item?.label || item || '').trim();
}

function getBackpackItemType(item) {
  const label = getBackpackItemLabel(item);
  if (label.startsWith('技能卡:')) {
    return 'skill';
  }
  if (item?.source === '剧情获取') {
    return 'plot';
  }
  return 'prop';
}

function buildBackpackActionMessage(action, item, inputMessage) {
  const label = getBackpackItemLabel(item);
  const itemText = label.replace(/^(装备|技能卡|物品):/, '').trim();
  const actionText = action === 'drop' ? '丢弃' : '使用';
  const trimmedInput = inputMessage.trim();

  if (!label) {
    return trimmedInput;
  }

  return trimmedInput ? `${actionText}${itemText}，${trimmedInput}` : `${actionText}${itemText}`;
}

function getCharacterMeta(characterInfo) {
  const info = characterInfo?.info || {};
  const gender = info.gender || info.sex || '未知';
  const age = info.age ? `${info.age}岁` : '年龄未知';
  const identity = info.job || info.race || info.worldType || '入梦者';
  return `${gender} · ${age} · ${identity}`;
}

function getMetricValue(characterInfo, keys, fallback = '--') {
  const metrics = characterInfo?.metrics || {};
  const key = keys.find((item) => metrics[item] !== undefined && metrics[item] !== null);
  return key ? metrics[key] : fallback;
}

function normalizeOverviewText(item) {
  return String(item || '')
    .replace(/^当前位置：/, '')
    .replace(/^当前剧情：/, '')
    .trim();
}

export function PlayMainPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [showHelp, setShowHelp] = useState(helpDialogConfig.help_continue_play.flag && firstLogin);
  const [showImage, setShowImage] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [activeBackpackTab, setActiveBackpackTab] = useState('prop');
  const [pendingBackpackAction, setPendingBackpackAction] = useState(null);
  const mainscroll = useRef(null);
  const { characterInfo, messageList, boardList, currentModuleName, waitingMessage, waitingImage, remainTime, sendMessage } = usePlaySession({
    gameId: id,
    socketUrl: 'ws://localhost:3300/',
  });

  const characterName = useMemo(() => characterInfo?.info?.name || '', [characterInfo]);
  const backpackList = boardList[0] || [];
  const storyOverviewList = boardList[1] || [];
  const visibleBackpackList = backpackList.filter(
    (item) => getBackpackItemType(item) === activeBackpackTab,
  );

  useEffect(() => {
    if (!mainscroll.current) {
      return;
    }
    const timer = window.setTimeout(() => {
      mainscroll.current?.scrollTo({ top: mainscroll.current.scrollHeight + 50000, behavior: 'smooth' });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [messageList.length, waitingMessage]);

  const handleSend = () => {
    const messageText = pendingBackpackAction
      ? buildBackpackActionMessage(
        pendingBackpackAction.action,
        pendingBackpackAction.item,
        inputMessage,
      )
      : inputMessage;

    if (sendMessage(messageText)) {
      setInputMessage('');
      setPendingBackpackAction(null);
    }
  };

  return (
    <>
      <div className="dream-play-page" style={{ backgroundImage: `url(${images.background})` }}>
        <div className="dream-play-shell">
          <section className="dream-chat-panel">
            <header className="dream-play-header">
              <div className="dream-title-group">
                <button className="dream-icon-button" type="button" onClick={() => navigate(-1)} title="返回">
                  <img alt="back" src={images.icon_back} />
                </button>
                <span className="dream-play-title">入梦</span>
              </div>
              <div className="dream-title-actions">
                <div className="dream-model-pill">
                  <img alt="model" src={iconSystemModel} />
                  <span>{`${currentModuleName || '模型'} · 剩余 ${remainTime} 次`}</span>
                </div>
                <button className="dream-icon-button" type="button" title="设置">
                  <img alt="setting" src={images.setting} />
                </button>
                <button className="dream-icon-button" type="button" onClick={() => setShowHelp(true)} title="产品帮助">
                  <img alt="help" src={images.question} />
                </button>
              </div>
            </header>

            <div ref={mainscroll} className="dream-message-scroll">
              {messageList.map((item, index) => {
                if (item.character !== 'me' && item.func === 'image') {
                  return <LeftImageMessage key={`${item.character}-${index}`} image={item.message} speakerName={getLeftSpeakerName(item)} onShowImage={setShowImage} immersive />;
                }
                if (item.character !== 'me') {
                  return <LeftChatMessage key={`${item.character}-${index}`} message={item.message} speakerName={getLeftSpeakerName(item)} immersive />;
                }
                return <RightChatMessage key={`${item.character}-${index}`} message={item.message} characterName={characterName} image={characterInfo?.image} immersive />;
              })}
              {waitingMessage && <img alt="waiting" className="dream-waiting" src={waitingImage} />}
            </div>

            <div className="dream-input-wrap">
              {pendingBackpackAction && (
                <div className="dream-pending-action">
                  <span>{`${pendingBackpackAction.action === 'drop' ? '丢弃' : '使用'}：${getBackpackItemLabel(pendingBackpackAction.item)}`}</span>
                  <button type="button" onClick={() => setPendingBackpackAction(null)}>取消</button>
                </div>
              )}
              <div className="dream-input-bar">
                <button className="dream-voice-button" type="button" title="语音">
                  <img alt="voice" src={images.icon_language} />
                </button>
                <Input.TextArea
                  autoSize={{ maxRows: 4 }}
                  placeholder="请尽情探索吧...  Shift+Enter 发送"
                  className="dream-input"
                  onKeyDown={(event) => {
                    if (event.shiftKey && event.key === 'Enter') {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  value={inputMessage}
                  onChange={(event) => setInputMessage(event.target.value)}
                />
                <button className="dream-send-button" type="button" onClick={handleSend}>
                  <span>发送</span>
                  <img alt="send" src={images.icon_send_message} />
                </button>
              </div>
            </div>
          </section>

          <aside className="dream-side-panel">
            <section className="dream-character-card">
              <img alt="avatar" className="dream-character-avatar" src={characterInfo?.image || images.icon_character_avater} />
              <div className="dream-character-info">
                <div className="dream-character-name">{characterName || '未命名角色'}</div>
                <div className="dream-character-meta">{getCharacterMeta(characterInfo)}</div>
              </div>
              <div className="dream-character-stats">
                <span>{`HP ${getMetricValue(characterInfo, ['hp', 'maxHp', 'constitution'], '--')}`}</span>
                <span>{`MP ${getMetricValue(characterInfo, ['mp', 'maxMp', 'power'], '--')}`}</span>
              </div>
            </section>

            <section className="dream-board-card dream-backpack-card">
              <div className="dream-board-header">
                <span>背包</span>
                <div className="dream-tab-group">
                  {backpackTabs.map((tab) => (
                    <button
                      key={tab.key}
                      className={activeBackpackTab === tab.key ? 'active' : ''}
                      type="button"
                      onClick={() => setActiveBackpackTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="dream-backpack-list">
                {visibleBackpackList.filter(Boolean).map((item, index) => {
                  const selected = pendingBackpackAction?.item === item;
                  return (
                    <div key={`backpack-${activeBackpackTab}-${index}`} className={`dream-backpack-item ${selected ? 'selected' : ''}`}>
                      <div className="dream-backpack-item-main">
                        <span>{getBackpackItemLabel(item)}</span>
                        {item.source && <em>{item.source}</em>}
                      </div>
                      <div className="dream-backpack-actions">
                        <button type="button" onClick={() => setPendingBackpackAction({ action: 'use', item })}>使用</button>
                        <button type="button" onClick={() => setPendingBackpackAction({ action: 'drop', item })}>丢弃</button>
                      </div>
                    </div>
                  );
                })}
                {!visibleBackpackList.length && <div className="dream-empty">暂无物品</div>}
              </div>
            </section>

            <section className="dream-board-card dream-overview-card">
              <div className="dream-board-header">
                <span>剧情概述</span>
              </div>
              <div className="dream-overview-list">
                {storyOverviewList.filter(Boolean).map((item, index) => (
                  <div key={`overview-${index}`} className={index === 0 ? 'active' : ''}>
                    <i />
                    <span>{normalizeOverviewText(item)}</span>
                  </div>
                ))}
                {!storyOverviewList.length && <div className="dream-empty">暂无剧情进展</div>}
              </div>
            </section>
          </aside>
        </div>
      </div>
      {showHelp && <HelpDialog id="help_continue_play" onClose={() => setShowHelp(false)} />}
      <ImageLightbox image={showImage} onClose={() => setShowImage('')} />
    </>
  );
}
