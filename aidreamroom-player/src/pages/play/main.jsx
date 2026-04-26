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

  if (item.character === 'system') {
    return '系统';
  }

  if (item.character === 'narrator') {
    return '艾达 AIDR（叙述者）';
  }

  return '艾达 AIDR';
}

function getLeftMessageVariant(item) {
  if (item.character === 'system') {
    return 'system';
  }

  if (item.character === 'narrator') {
    return 'narrator';
  }

  return 'character';
}

const backpackTabs = [
  { key: 'prop', label: '道具' },
  { key: 'plot', label: '剧情物品' },
  { key: 'skill', label: '技能' },
];

const inputModeOptions = [
  { key: 'action', label: '动作' },
  { key: 'thought', label: '思考' },
  { key: 'dialogue', label: '对话' },
];

function getInputModeLabel(mode) {
  return inputModeOptions.find((item) => item.key === mode)?.label || '动作';
}

const detailTabOptions = [
  { key: 'overview', label: '剧情概述' },
  { key: 'records', label: '信息记录' },
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
  return String(item || '').trim();
}

function canRecordDialogue(item) {
  return Boolean(
    item &&
    item.func === 'chat' &&
    item.character &&
    item.character !== 'me' &&
    item.character !== 'system',
  );
}

export function PlayMainPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [showHelp, setShowHelp] = useState(helpDialogConfig.help_continue_play.flag && firstLogin);
  const [showImage, setShowImage] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [inputMode, setInputMode] = useState('action');
  const [activeBackpackTab, setActiveBackpackTab] = useState('prop');
  const [activeDetailTab, setActiveDetailTab] = useState('overview');
  const [pendingBackpackAction, setPendingBackpackAction] = useState(null);
  const mainscroll = useRef(null);
  const {
    characterInfo,
    messageList,
    boardList,
    currentModuleName,
    waitingMessage,
    waitingImage,
    remainTime,
    isFinish,
    dialogueRecordList,
    isDialogueRecorded,
    saveDialogueRecord,
    hintOptions,
    hintLoading,
    requestHintOptions,
    sendHintOption,
    sendMessage,
  } = usePlaySession({
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
    const nextInputMode = pendingBackpackAction ? 'action' : inputMode;

    if (sendMessage(messageText, { inputMode: nextInputMode })) {
      setInputMessage('');
      setPendingBackpackAction(null);
    }
  };

  const handleHintRequest = async () => {
    await requestHintOptions(inputMessage);
  };

  const handleHintSelect = (option) => {
    if (sendHintOption(option)) {
      setInputMode(option.mode || 'action');
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
                  return (
                    <LeftChatMessage
                      key={`${item.character}-${index}`}
                      message={item.message}
                      speakerName={getLeftSpeakerName(item)}
                      variant={getLeftMessageVariant(item)}
                      immersive
                      showRecordButton={canRecordDialogue(item)}
                      recorded={isDialogueRecorded(item)}
                      onRecord={() => saveDialogueRecord(item)}
                    />
                  );
                }
                return <RightChatMessage key={`${item.character}-${index}`} message={item.message} characterName={characterName} image={characterInfo?.image} mode={item.mode} immersive />;
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
              <div className="dream-input-mode-group">
                {inputModeOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={inputMode === option.key ? 'active' : ''}
                    onClick={() => setInputMode(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {hintOptions.length ? (
                <div className="dream-hint-panel">
                  <div className="dream-hint-header">
                    <span>AI 提示</span>
                    <button type="button" onClick={handleHintRequest} disabled={hintLoading}>
                      {hintLoading ? '生成中...' : '换一组'}
                    </button>
                  </div>
                  <div className="dream-hint-list">
                    {hintOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className="dream-hint-option"
                        onClick={() => handleHintSelect(option)}
                      >
                        <div className="dream-hint-option-top">
                          <span className={`dream-hint-badge is-${option.mode}`}>{getInputModeLabel(option.mode)}</span>
                          <strong>{option.label}</strong>
                        </div>
                        <p>{option.content}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="dream-input-bar">
                <button className="dream-voice-button" type="button" title="语音">
                  <img alt="voice" src={images.icon_language} />
                </button>
                <Input.TextArea
                  autoSize={{ maxRows: 4 }}
                  placeholder={
                    inputMode === 'dialogue'
                      ? '输入你要说的话...  Enter 发送，Shift+Enter 换行'
                      : inputMode === 'thought'
                        ? '输入角色的思考、判断或试探...  Enter 发送，Shift+Enter 换行'
                        : '输入动作或行为...  Enter 发送，Shift+Enter 换行'
                  }
                  className="dream-input"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  value={inputMessage}
                  onChange={(event) => setInputMessage(event.target.value)}
                />
                <button
                  className="dream-hint-button"
                  type="button"
                  onClick={handleHintRequest}
                  disabled={hintLoading || waitingMessage || isFinish}
                >
                  {hintLoading ? '生成中...' : '给我个提示'}
                </button>
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
                        {item.description ? <p>{item.description}</p> : null}
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
                <span>{detailTabOptions.find((item) => item.key === activeDetailTab)?.label || '剧情概述'}</span>
                <div className="dream-tab-group">
                  {detailTabOptions.map((tab) => (
                    <button
                      key={tab.key}
                      className={activeDetailTab === tab.key ? 'active' : ''}
                      type="button"
                      onClick={() => setActiveDetailTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              {activeDetailTab === 'overview' ? (
                <div className="dream-overview-list">
                  {storyOverviewList.filter(Boolean).map((item, index) => (
                    <div key={`overview-${index}`} className={index === 0 ? 'active' : ''}>
                      <i />
                      <span>{normalizeOverviewText(item)}</span>
                    </div>
                  ))}
                  {!storyOverviewList.length && <div className="dream-empty">暂无已完成剧情节点</div>}
                </div>
              ) : (
                <div className="dream-record-list">
                  {dialogueRecordList.map((item) => (
                    <div key={item.id} className="dream-record-item">
                      <strong>{item.speaker || getLeftSpeakerName(item)}</strong>
                      <p>{item.message}</p>
                    </div>
                  ))}
                  {!dialogueRecordList.length && <div className="dream-empty">在 NPC 对话右下角点击“记录”后，会显示在这里</div>}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
      {showHelp && <HelpDialog id="help_continue_play" onClose={() => setShowHelp(false)} />}
      <ImageLightbox image={showImage} onClose={() => setShowImage('')} />
    </>
  );
}
