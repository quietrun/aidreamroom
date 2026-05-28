import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from 'antd';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import '../../styles/index.scss';
import { firstLogin, helpDialogConfig, images } from '../../constant';
import { HelpDialog } from '../../components/common/HelpDialog';
import { ImageLightbox } from '../../components/play/ChatParts';
import { usePlaySession } from '../../hooks/usePlaySession';
import { resolveLegacyWsUrl } from '../../utils/network';

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

const INTRO_VIDEO_SCRIPT_ID = 'a79e10de42ef2ab9c4fa839ba96e1ea4';
const INTRO_VIDEO_URL = `http://47.245.42.208:8580/pic/${INTRO_VIDEO_SCRIPT_ID}.mp4`;

const sideTabs = [
  { key: 'response', icon: '✎', title: '回应', label: '回应' },
  { key: 'character', icon: '我', title: '角色', label: '角色' },
  { key: 'backpack', icon: '包', title: '背包', label: '背包' },
  { key: 'scene', icon: '图', title: '场景', label: '场景' },
  { key: 'record', icon: '忆', title: '记录', label: '记录' },
];

const attributeList = [
  ['str', '力', ['str', 'strength', 'power']],
  ['dex', '敏', ['dex', 'dexterity', 'agility']],
  ['con', '耐', ['con', 'constitution', 'stamina']],
  ['int', '智', ['int', 'intelligence']],
  ['wil', '意', ['wil', 'will', 'willpower']],
  ['per', '感', ['per', 'perception']],
  ['cha', '魅', ['cha', 'charm', 'charisma']],
  ['luck', '运', ['luck']],
  ['spirit', '灵', ['spirit', 'soul']],
];

function getLeftSpeakerName(item) {
  if (item?.speaker) {
    return item.speaker;
  }
  if (item?.character === 'system') {
    return '系统';
  }
  if (item?.character === 'narrator') {
    return '艾达 AIDR（叙述者）';
  }
  return '艾达 AIDR';
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

function getInputModeLabel(mode) {
  return inputModeOptions.find((item) => item.key === mode)?.label || '动作';
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
  const info = characterInfo?.info || {};
  const key = keys.find((item) => metrics[item] !== undefined && metrics[item] !== null);
  const infoKey = keys.find((item) => info[item] !== undefined && info[item] !== null);
  return key ? metrics[key] : infoKey ? info[infoKey] : fallback;
}

function hasMetricValue(characterInfo, keys) {
  const metrics = characterInfo?.metrics || {};
  const info = characterInfo?.info || {};
  return keys.some((key) => (
    metrics[key] !== undefined ||
    info[key] !== undefined
  ));
}

function getRatioPercent(current, max) {
  const value = Number(current);
  const limit = Number(max);
  if (!Number.isFinite(value) || !Number.isFinite(limit) || limit <= 0) {
    return 55;
  }
  return Math.max(0, Math.min(100, (value / limit) * 100));
}

function parseMaybeJson(value) {
  if (!value) {
    return {};
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function getScriptMetadata(plotInfo) {
  return parseMaybeJson(plotInfo?.metadata);
}

function getSceneSnapshot(gameInfo) {
  return gameInfo?.snapshot || gameInfo?.runtime?.snapshot || {};
}

function getSceneTitle(plotInfo, gameInfo) {
  const snapshot = getSceneSnapshot(gameInfo);
  const metadata = getScriptMetadata(plotInfo);
  return (
    snapshot.currentLocationName ||
    snapshot.currentNodeTitle ||
    metadata.currentLocationName ||
    plotInfo?.title ||
    plotInfo?.name ||
    '未知场景'
  );
}

function getScriptTitle(plotInfo) {
  const metadata = getScriptMetadata(plotInfo);
  return metadata.title || plotInfo?.title || plotInfo?.name || plotInfo?.scriptName || '未命名剧本';
}

function getSceneSubtitle(gameInfo) {
  const snapshot = getSceneSnapshot(gameInfo);
  const parts = [
    snapshot.timeLabel || snapshot.currentTime || '夜 · 21:46',
    snapshot.weatherLabel || snapshot.weather || '雨',
    snapshot.threatLevel ? `威胁 ${snapshot.threatLevel}` : '威胁 低',
    snapshot.canDiscover === false ? '' : '可被发现',
  ].filter(Boolean);
  return parts.join(' · ');
}

function getCurrentLocationId(gameInfo) {
  const snapshot = getSceneSnapshot(gameInfo);
  return (
    snapshot.currentLocationId ||
    snapshot.currentLocId ||
    snapshot.locationId ||
    snapshot.locId ||
    snapshot.loc_id ||
    snapshot.currentLocation?.id ||
    snapshot.currentLocation?.loc_id ||
    snapshot.currentLocation?.uuid ||
    ''
  );
}

function getScriptUuid(plotInfo) {
  return plotInfo?.uuid || plotInfo?.scriptId || plotInfo?.script_id || '';
}

function getSceneBackground(plotInfo, gameInfo) {
  const locId = getCurrentLocationId(gameInfo);
  const scriptUuid = getScriptUuid(plotInfo);

  if (scriptUuid && locId) {
    return `http://47.245.42.208:8580/pic/${scriptUuid}/map/${locId}.png`;
  }

  return (
    plotInfo?.cover ||
    plotInfo?.image ||
    plotInfo?.poster ||
    images.bg2
  );
}

function getPresentNpcIds(gameInfo) {
  const snapshot = getSceneSnapshot(gameInfo);
  const rawIds = Array.isArray(snapshot.presentNpcIds)
    ? snapshot.presentNpcIds
    : Array.isArray(snapshot.presentNpcs)
      ? snapshot.presentNpcs.map((item) => item?.npcId || item?.id || item?.npc_id || item)
      : [];

  return [...new Set(rawIds.map((item) => String(item || '').trim()).filter(Boolean))];
}

function getNpcImageUrl(scriptUuid, npcId, variant = 'full') {
  return `http://47.245.42.208:8580/pic/${scriptUuid}/npc/${encodeURIComponent(npcId)}_${variant}.png`;
}

function getLastNpcMessage(messageList) {
  const item = [...messageList].reverse().find((message) => (
    message.character !== 'me' && message.func !== 'image' && String(message.message || '').trim()
  ));
  return item || null;
}

function getDialogueNpcId(lastNpcMessage, presentNpcIds) {
  const messageNpcId = String(lastNpcMessage?.character || '').trim();
  if (messageNpcId && !['system', 'narrator', 'me'].includes(messageNpcId)) {
    return messageNpcId;
  }
  return presentNpcIds[0] || '';
}

function isAidrMessage(item) {
  const character = String(item?.character || '').trim();
  return character === 'system' || character === 'narrator';
}

function getMessageAvatar(item, scriptUuid, characterInfo) {
  const character = String(item?.character || '').trim();

  if (isAidrMessage(item)) {
    return images.ava_aidr;
  }

  if (character === 'me') {
    return characterInfo?.image || images.icon_character_avater;
  }

  if (scriptUuid && character) {
    return getNpcImageUrl(scriptUuid, character, 'half');
  }

  return images.ava_aidr;
}

function getRecordKind(item) {
  if (item.character === 'system') {
    return 'system';
  }
  if (item.character === 'narrator') {
    return 'narrator';
  }
  if (item.character === 'me') {
    return item.mode || 'action';
  }
  return 'character';
}

function formatMessageTime(index) {
  return `21:${String(42 + (index % 18)).padStart(2, '0')}`;
}

export function PlayMain2DPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const introVideoRef = useRef(null);
  const [showHelp, setShowHelp] = useState(helpDialogConfig.help_continue_play.flag && firstLogin);
  const [showImage, setShowImage] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [inputMode, setInputMode] = useState('action');
  const [activeBackpackTab, setActiveBackpackTab] = useState('prop');
  const [activeSideTab, setActiveSideTab] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [pendingBackpackAction, setPendingBackpackAction] = useState(null);
  const shouldShowIntroVideo = Boolean(
    location.state?.fromNewGame &&
    location.state?.scriptId === INTRO_VIDEO_SCRIPT_ID,
  );
  const [introVideoVisible, setIntroVideoVisible] = useState(shouldShowIntroVideo);
  const [introVideoEnded, setIntroVideoEnded] = useState(false);
  const {
    plotInfo,
    characterInfo,
    gameInfo,
    messageList,
    boardList,
    currentModuleName,
    waitingMessage,
    waitingImage,
    remainTime,
    isFinish,
    dialogueRecordList,
    hintOptions,
    hintLoading,
    requestHintOptions,
    sendHintOption,
    sendMessage,
  } = usePlaySession({
    gameId: id,
    socketUrl: resolveLegacyWsUrl(),
  });

  const characterName = characterInfo?.info?.name || '未命名角色';
  const backpackList = boardList[0] || [];
  const storyOverviewList = boardList[1] || [];
  const visibleBackpackList = backpackList.filter(
    (item) => getBackpackItemType(item) === activeBackpackTab,
  );
  const lastNpcMessage = useMemo(() => getLastNpcMessage(messageList), [messageList]);
  const sceneTitle = getSceneTitle(plotInfo, gameInfo);
  const scriptTitle = getScriptTitle(plotInfo);
  const sceneSubtitle = getSceneSubtitle(gameInfo);
  const backgroundImage = getSceneBackground(plotInfo, gameInfo);
  const scriptUuid = getScriptUuid(plotInfo);
  const presentNpcIds = useMemo(() => getPresentNpcIds(gameInfo), [gameInfo]);
  const dialogueNpcId = getDialogueNpcId(lastNpcMessage, presentNpcIds);
  const isCurrentAidrMessage = isAidrMessage(lastNpcMessage);
  const dialogueAvatar = isCurrentAidrMessage
    ? images.ava_aidr
    : scriptUuid && dialogueNpcId
      ? getNpcImageUrl(scriptUuid, dialogueNpcId, 'half')
      : characterInfo?.image || images.icon_character_avater;
  const dialogueHalfImage = isCurrentAidrMessage ? images.aidr_women : dialogueAvatar;
  const hasHp = hasMetricValue(characterInfo, ['hp', 'currentHp', 'health', 'maxHp', 'hpMax']);
  const hasSp = hasMetricValue(characterInfo, ['sp', 'currentSp', 'san', 'sanity', 'maxSp', 'spMax']);
  const hp = getMetricValue(characterInfo, ['hp', 'currentHp', 'health']);
  const maxHp = getMetricValue(characterInfo, ['maxHp', 'hpMax']);
  const sp = getMetricValue(characterInfo, ['sp', 'currentSp', 'san', 'sanity']);
  const maxSp = getMetricValue(characterInfo, ['maxSp', 'spMax']);

  useEffect(() => {
    if (!introVideoVisible || !introVideoRef.current) {
      return;
    }

    const video = introVideoRef.current;
    video.currentTime = 0;
    video.muted = false;
    const playPromise = video.play();

    if (playPromise?.catch) {
      playPromise.catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    }
  }, [introVideoVisible]);

  const hideIntroVideo = () => {
    if (introVideoRef.current) {
      introVideoRef.current.pause();
    }
    setIntroVideoVisible(false);
  };

  const handleIntroVideoClick = () => {
    if (introVideoEnded) {
      hideIntroVideo();
    }
  };

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
      setComposerOpen(false);
    }
  };

  const handleHintRequest = async () => {
    setComposerOpen(true);
    await requestHintOptions(inputMessage);
  };

  const isSideTabSelected = (tabKey) => (
    tabKey === 'response'
      ? activeSideTab === 'response' && composerOpen
      : activeSideTab === tabKey
  );

  const closeSideTab = () => {
    setActiveSideTab(null);
    setComposerOpen(false);
  };

  const handleSideTabClick = (tabKey) => {
    if (isSideTabSelected(tabKey)) {
      closeSideTab();
      return;
    }

    if (tabKey === 'response') {
      setActiveSideTab('response');
      setComposerOpen(true);
      return;
    }

    setActiveSideTab(tabKey);
    setComposerOpen(false);
  };

  const toggleResponseComposer = () => {
    handleSideTabClick('response');
  };

  const handleHintSelect = (option) => {
    if (sendHintOption(option)) {
      setInputMode(option.mode || 'action');
      setInputMessage('');
      setPendingBackpackAction(null);
      setComposerOpen(false);
    }
  };

  const handleBackpackAction = (action, item) => {
    setPendingBackpackAction({ action, item });
    setInputMode('action');
    setActiveSideTab('response');
    setComposerOpen(true);
  };

  const handleNpcClick = () => {
    setPendingBackpackAction(null);
    setInputMode('dialogue');
    setActiveSideTab('response');
    setComposerOpen(true);
  };

  const handleSkip = () => {
    sendMessage('我暂时保持沉默，继续观察周围变化。', { inputMode: 'action' });
  };

  const renderPanel = () => {
    if (activeSideTab === 'character') {
      return (
        <div className="play2d-panel-body">
          <div className="play2d-character-head">
            <img alt="avatar" src={characterInfo?.image || images.icon_character_avater} />
            <div>
              <h3>{characterName}</h3>
              <p>{getCharacterMeta(characterInfo)}</p>
              <div className="play2d-chip-row">
                <span>经验 {getMetricValue(characterInfo, ['exp', 'experience'])}</span>
                <span>总值 {getMetricValue(characterInfo, ['score', 'total'])}</span>
                <span className="green">隐蔽中</span>
              </div>
            </div>
          </div>
          {(hasHp || hasSp) ? (
            <div className="play2d-vital-grid">
              {hasHp ? (
                <div className="is-hp">
                  <span>生命 HP</span>
                  <strong>{hp} / {maxHp}</strong>
                  <i><b style={{ width: `${getRatioPercent(hp, maxHp)}%` }} /></i>
                </div>
              ) : null}
              {hasSp ? (
                <div className="is-sp">
                  <span>精神 SP</span>
                  <strong>{sp} / {maxSp}</strong>
                  <i><b style={{ width: `${getRatioPercent(sp, maxSp)}%` }} /></i>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="play2d-subtitle">九维属性</div>
          <div className="play2d-attr-grid">
            {attributeList.map(([key, label, keys], index) => (
              <div key={key}>
                <span>{label}</span>
                <strong>{getMetricValue(characterInfo, keys, [52, 68, 45, 71, 60, 63, 38, 55, 49][index])}</strong>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeSideTab === 'backpack') {
      return (
        <div className="play2d-panel-body">
          <div className="play2d-segment">
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
          <div className="play2d-item-list">
            {visibleBackpackList.filter(Boolean).map((item, index) => (
              <div key={`play2d-item-${activeBackpackTab}-${index}`} className="play2d-item-card">
                <div>
                  <strong>{getBackpackItemLabel(item)}</strong>
                  {item.source ? <span>{item.source}</span> : null}
                  {item.description ? <p>{item.description}</p> : null}
                </div>
                <div>
                  <button type="button" onClick={() => handleBackpackAction('use', item)}>使用</button>
                  <button type="button" onClick={() => handleBackpackAction('drop', item)}>丢弃</button>
                </div>
              </div>
            ))}
            {!visibleBackpackList.length && <div className="play2d-empty">暂无物品</div>}
          </div>
        </div>
      );
    }

    if (activeSideTab === 'scene') {
      return (
        <div className="play2d-panel-body">
          <div className="play2d-scene-card">
            <strong>{sceneTitle}</strong>
            <span>{sceneSubtitle}</span>
          </div>
          <div className="play2d-subtitle">剧情进度</div>
          <div className="play2d-progress-list">
            {storyOverviewList.filter(Boolean).map((item, index) => (
              <div key={`play2d-overview-${index}`} className={index < storyOverviewList.length - 1 ? 'done' : 'active'}>
                <i />
                <span>{String(item).trim()}</span>
                {index === storyOverviewList.length - 1 ? <em>进行中</em> : null}
              </div>
            ))}
            {!storyOverviewList.length && <div className="play2d-empty">暂无已完成剧情节点</div>}
          </div>
        </div>
      );
    }

    if (activeSideTab === 'record') {
      const records = [
        ...messageList.slice(-8).map((item, index) => ({
          ...item,
          id: `message-${index}-${item.character}`,
          time: formatMessageTime(index),
        })),
        ...dialogueRecordList.slice(0, 10).map((item, index) => ({
          ...item,
          id: `record-${item.id || index}`,
          time: formatMessageTime(index + 8),
        })),
      ].filter((item) => String(item.message || '').trim());

      return (
        <div className="play2d-panel-body play2d-record-scroll">
          <div className="play2d-record-divider">二层走廊</div>
          {records.map((item, index) => (
            <div
              key={item.id || `play2d-record-${index}`}
              className={`play2d-record-bubble is-${getRecordKind(item)} ${item.character === 'me' ? 'mine' : ''}`}
            >
              <img
                className="play2d-record-avatar"
                alt={item.character === 'me' ? characterName : getLeftSpeakerName(item)}
                src={getMessageAvatar(item, scriptUuid, characterInfo)}
              />
              <div className="play2d-record-content">
                <div className="play2d-record-meta">
                  <span>{item.character === 'me' ? characterName : getLeftSpeakerName(item)}</span>
                  <em>{item.time}</em>
                  {item.mode ? <b>{getInputModeLabel(item.mode)}</b> : null}
                </div>
                {item.func === 'image' ? (
                  <img
                    className="play2d-record-image"
                    alt="record"
                    src={item.message}
                    onClick={() => setShowImage(item.message)}
                  />
                ) : (
                  <p>{item.message}</p>
                )}
              </div>
            </div>
          ))}
          {!records.length && <div className="play2d-empty">暂无记录</div>}
        </div>
      );
    }

    return (
      <div className="play2d-panel-body play2d-response-panel">
        {pendingBackpackAction ? (
          <div className="play2d-pending-action">
            <span>{`${pendingBackpackAction.action === 'drop' ? '丢弃' : '使用'}：${getBackpackItemLabel(pendingBackpackAction.item)}`}</span>
            <button type="button" onClick={() => setPendingBackpackAction(null)}>取消</button>
          </div>
        ) : null}
        <div className="play2d-segment">
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
          <div className="play2d-hint-list">
            {hintOptions.map((option) => (
              <button key={option.id} type="button" onClick={() => handleHintSelect(option)}>
                <span>{getInputModeLabel(option.mode)} · {option.label}</span>
                <p>{option.content}</p>
              </button>
            ))}
          </div>
        ) : null}
        <div className="play2d-input-bar">
          <Input.TextArea
            autoSize={{ minRows: 2, maxRows: 4 }}
            className="play2d-compose-input"
            placeholder={
              inputMode === 'dialogue'
                ? '输入你要说的话...  Enter 发送，Shift+Enter 换行'
                : inputMode === 'thought'
                  ? '输入角色的思考、判断或试探...  Enter 发送，Shift+Enter 换行'
                  : '输入动作或行为...  Enter 发送，Shift+Enter 换行'
            }
            value={inputMessage}
            onChange={(event) => setInputMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="play2d-compose-actions">
            <button type="button" onClick={handleHintRequest} disabled={hintLoading || waitingMessage || isFinish}>
              {hintLoading ? '生成中...' : '提示'}
            </button>
            <button type="button" className="primary" onClick={handleSend} disabled={waitingMessage || isFinish}>回应</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="play2d-page">
        <div className="play2d-frame">
          <header className="play2d-header">
            <div className="play2d-titlebar">
              <button type="button" onClick={() => navigate(-1)} title="返回">‹</button>
              <strong>{scriptTitle}</strong>
              <span>· {sceneTitle}</span>
            </div>
            <div className="play2d-header-actions">
              <span className="play2d-model-pill">{`${currentModuleName || '模型'} · 剩余 ${remainTime} 次`}</span>
              <button type="button" title="设置">
                <img alt="setting" src={images.setting} />
              </button>
              <button type="button" onClick={() => setShowHelp(true)} title="帮助">
                <img alt="help" src={images.question} />
              </button>
            </div>
          </header>

          <main
            className={`play2d-stage${composerOpen && activeSideTab === 'response' ? ' is-composing' : ''}`}
            style={{ backgroundImage: `url(${backgroundImage})` }}
          >
            <div className="play2d-scene-pills">
              <span><b>{sceneTitle}</b></span>
              <span><i /> {sceneSubtitle}</span>
            </div>

            {/* <button className="play2d-hotspot note" type="button" onClick={toggleResponseComposer}>✎</button>
            <button className="play2d-object-card door" type="button">
              <span>▮</span>
            </button>
            <button className="play2d-object-card npc" type="button" onClick={() => setActiveSideTab('character')}>
              <span>人</span>
              <em>{characterName}</em>
            </button>
            <button className="play2d-hotspot person" type="button" onClick={() => setActiveSideTab('character')}>人</button>
            <button className="play2d-hotspot clue" type="button" onClick={() => setActiveSideTab('scene')}>⌬</button>
            <button className="play2d-hotspot eye" type="button" onClick={() => setActiveSideTab('scene')}>⌁</button> */}

            {scriptUuid && presentNpcIds.length ? (
              <div className="play2d-npc-layer" aria-label="当前场景人物">
                {presentNpcIds.slice(0, 4).map((npcId, index) => (
                  <img
                    key={npcId}
                    alt={npcId}
                    className={`play2d-npc-standee is-count-${Math.min(presentNpcIds.length, 4)} is-index-${index}`}
                    src={getNpcImageUrl(scriptUuid, npcId)}
                    onClick={handleNpcClick}
                  />
                ))}
              </div>
            ) : null}

            <section className={`play2d-side-drawer ${!activeSideTab || activeSideTab === 'response' ? 'collapsed' : ''}`}>
              {activeSideTab && activeSideTab !== 'response' ? (
                <>
                  <div className="play2d-panel-header">
                    <strong>◆ {sideTabs.find((item) => item.key === activeSideTab)?.title}</strong>
                    <button type="button" onClick={closeSideTab}>›</button>
                  </div>
                  {renderPanel()}
                </>
              ) : null}
            </section>

            <nav className="play2d-rail">
              {sideTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={isSideTabSelected(tab.key) ? 'active' : ''}
                  onClick={() => handleSideTabClick(tab.key)}
                >
                  <strong>{tab.icon}</strong>
                  <span>{isSideTabSelected(tab.key) ? '收起' : tab.label}</span>
                  {tab.badge ? <em>{tab.badge}</em> : null}
                </button>
              ))}
            </nav>
            <section className={`play2d-dialogue-box${composerOpen && activeSideTab === 'response' ? ' is-composing' : ''}`}>
              {!(composerOpen && activeSideTab === 'response') && <>
                <div className="play2d-dialogue-head">
                  <img alt="speaker" src={dialogueAvatar} />
                  <strong>{lastNpcMessage ? getLeftSpeakerName(lastNpcMessage) : characterName}</strong>
                  {/* <span>对话</span> */}
                  <div>
                    {/* <button type="button" onClick={handleHintRequest} disabled={hintLoading || waitingMessage || isFinish}>提示</button> */}
                    {/* <button type="button" onClick={handleSkip} disabled={waitingMessage || isFinish}>跳过</button> */}

                  </div>
                  {/* <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      setActiveSideTab('response');
                      setComposerOpen(true);
                    }}
                  >
                    回应
                  </button> */}
                </div>
                <img src={dialogueHalfImage} className='dialog-half-image' />

                <p>{lastNpcMessage?.message || '你站在场景中，四周的细节逐渐清晰。'}</p>
                {waitingMessage ? <img alt="waiting" className="play2d-waiting" src={waitingImage} /> : null}
              </>}
              {composerOpen && activeSideTab === 'response' ? renderPanel() : null}
            </section>
          </main>
        </div>
      </div>
      {introVideoVisible ? (
        <div
          className={`play2d-intro-video${introVideoEnded ? ' is-ended' : ''}`}
          onClick={handleIntroVideoClick}
        >
          <video
            ref={introVideoRef}
            className="play2d-intro-video__media"
            src={INTRO_VIDEO_URL}
            preload="auto"
            playsInline
            onEnded={() => setIntroVideoEnded(true)}
          />
          {introVideoEnded ? (
            <div className="play2d-intro-video__hint">点击屏幕开始游戏</div>
          ) : null}
          <button
            type="button"
            className="play2d-intro-video__skip"
            onClick={(event) => {
              event.stopPropagation();
              hideIntroVideo();
            }}
          >
            跳过
          </button>
        </div>
      ) : null}
      {showHelp && <HelpDialog id="help_continue_play" onClose={() => setShowHelp(false)} />}
      <ImageLightbox image={showImage} onClose={() => setShowImage('')} />
    </>
  );
}
