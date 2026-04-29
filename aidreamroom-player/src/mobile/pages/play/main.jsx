import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import '../../styles/index.scss';
import { images } from '../../../constant';
import { usePlaySession } from '../../../hooks/usePlaySession';
import { resolveLegacyWsUrl } from '../../../utils/network';
import { LeftChatMessage, LeftImageMessage, RightChatMessage, ImageLightbox } from '../../../components/play/ChatParts';
import iconSystemModel from '@/icon_system_model.png';

const backpackTabs = [
  { key: 'prop', label: '道具' },
  { key: 'plot', label: '剧情' },
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

const sheetTabOptions = [
  { key: 'backpack', label: '背包' },
  { key: 'overview', label: '剧情' },
  { key: 'records', label: '记录' },
];

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

function canRecordDialogue(item) {
  return Boolean(
    item &&
    item.func === 'chat' &&
    item.character &&
    item.character !== 'me' &&
    item.character !== 'system',
  );
}

export function MobilePlayMainPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const mainscroll = useRef(null);
  const [inputMessage, setInputMessage] = useState('');
  const [inputMode, setInputMode] = useState('action');
  const [showImage, setShowImage] = useState('');
  const [activeBackpackTab, setActiveBackpackTab] = useState('prop');
  const [activeSheetTab, setActiveSheetTab] = useState('backpack');
  const [showBackpack, setShowBackpack] = useState(false);
  const [pendingBackpackAction, setPendingBackpackAction] = useState(null);
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
    socketUrl: resolveLegacyWsUrl(),
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
    <div className="mobile-app">
      <div className="main-container mobile-dream-page" style={{ background: `url(${images.background})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
        <div className="mobile-dream-shell">
          <div className="mobile-dream-header">
            <button className="mobile-round-icon" type="button" onClick={() => navigate(-1)}>
              <img alt="back" src={images.icon_back} />
            </button>
            <span className="mobile-dream-title">入梦</span>
            <div className="mobile-model-pill">
              <img alt="model" src={iconSystemModel} />
              <span>{`${currentModuleName || 'GPT-4O'} · 剩余${remainTime}次`}</span>
            </div>
            <button className="mobile-header-pill" type="button" onClick={() => { setActiveSheetTab('backpack'); setShowBackpack(true); }}>面板</button>
          </div>

          <div ref={mainscroll} className="mobile-dream-scroll">
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
            {waitingMessage && <img alt="waiting" src={waitingImage} className="mobile-dream-waiting" />}
          </div>

          <div className="mobile-dream-input-wrap">
            {pendingBackpackAction ? (
              <div className="mobile-pending-action">
                <span>{`${pendingBackpackAction.action === 'drop' ? '丢弃' : '使用'}：${getBackpackItemLabel(pendingBackpackAction.item)}`}</span>
                <button type="button" onClick={() => setPendingBackpackAction(null)}>取消</button>
              </div>
            ) : null}
            <div className="mobile-input-mode-group">
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
              <div className="mobile-hint-panel">
                <div className="mobile-hint-header">
                  <span>AI 提示</span>
                  <button type="button" onClick={handleHintRequest} disabled={hintLoading}>
                    {hintLoading ? '生成中...' : '换一组'}
                  </button>
                </div>
                <div className="mobile-hint-list">
                  {hintOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="mobile-hint-option"
                      onClick={() => handleHintSelect(option)}
                    >
                      <div className="mobile-hint-option-top">
                        <span className={`mobile-hint-badge is-${option.mode}`}>{getInputModeLabel(option.mode)}</span>
                        <strong>{option.label}</strong>
                      </div>
                      <p>{option.content}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mobile-dream-input-bar">
              <button className="mobile-input-icon" type="button">
                <img alt="voice" src={images.icon_language} />
              </button>
              <Input.TextArea
                autoSize={{ maxRows: 4 }}
                placeholder={
                  inputMode === 'dialogue'
                    ? '输入你要说的话... Enter发送'
                    : inputMode === 'thought'
                      ? '输入角色思考... Enter发送'
                      : '输入动作... Enter发送'
                }
                className="mobile-dream-input"
                value={inputMessage}
                onChange={(event) => setInputMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                className="mobile-hint-button"
                type="button"
                onClick={handleHintRequest}
                disabled={hintLoading || waitingMessage || isFinish}
              >
                {hintLoading ? '生成中' : '给我个提示'}
              </button>
              <button className="mobile-send-button" type="button" onClick={handleSend}>发送</button>
            </div>
          </div>
        </div>

        {showBackpack ? (
          <div className="mobile-backpack-mask" onClick={() => setShowBackpack(false)}>
            <section className="mobile-backpack-sheet" onClick={(event) => event.stopPropagation()}>
              <i className="mobile-sheet-handle" />
              <div className="mobile-backpack-header">
                <span>{sheetTabOptions.find((item) => item.key === activeSheetTab)?.label || '面板'}</span>
                <div className="mobile-panel-tabs">
                  {sheetTabOptions.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={activeSheetTab === tab.key ? 'active' : ''}
                      onClick={() => setActiveSheetTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              {activeSheetTab === 'backpack' ? (
                <>
                  <div className="mobile-backpack-tabs">
                    {backpackTabs.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        className={activeBackpackTab === tab.key ? 'active' : ''}
                        onClick={() => setActiveBackpackTab(tab.key)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="mobile-backpack-list">
                    {visibleBackpackList.filter(Boolean).map((item, index) => (
                      <div key={`mobile-backpack-${activeBackpackTab}-${index}`} className="mobile-backpack-item">
                        <div>
                          <strong>{getBackpackItemLabel(item)}</strong>
                          {item.source ? <span>{item.source}</span> : <span>初始道具</span>}
                          {item.description ? <p>{item.description}</p> : null}
                        </div>
                        <div className="mobile-backpack-actions">
                          <button type="button" onClick={() => { setPendingBackpackAction({ action: 'use', item }); setShowBackpack(false); }}>使用</button>
                          <button type="button" onClick={() => { setPendingBackpackAction({ action: 'drop', item }); setShowBackpack(false); }}>丢弃</button>
                        </div>
                      </div>
                    ))}
                    {!visibleBackpackList.length ? <div className="mobile-empty-text">暂无物品</div> : null}
                  </div>
                </>
              ) : null}
              {activeSheetTab === 'overview' ? (
                <div className="mobile-record-list">
                  {storyOverviewList.map((item, index) => (
                    <div key={`mobile-overview-${index}`} className={`mobile-record-item ${index === 0 ? 'active' : ''}`}>
                      <strong>{item}</strong>
                    </div>
                  ))}
                  {!storyOverviewList.length ? <div className="mobile-empty-text">暂无已完成剧情节点</div> : null}
                </div>
              ) : null}
              {activeSheetTab === 'records' ? (
                <div className="mobile-record-list">
                  {dialogueRecordList.map((item) => (
                    <div key={item.id} className="mobile-record-item">
                      <strong>{item.speaker || getLeftSpeakerName(item)}</strong>
                      <p>{item.message}</p>
                    </div>
                  ))}
                  {!dialogueRecordList.length ? <div className="mobile-empty-text">在 NPC 对话右下角点击“记录”后，会显示在这里</div> : null}
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
      <ImageLightbox image={showImage} onClose={() => setShowImage('')} />
    </div>
  );
}
