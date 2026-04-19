import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import '../../styles/index.scss';
import { firstLogin, helpDialogConfig, images } from '../../constant';
import { AidrIntroduction } from '../../components/common/AidrIntroduction';
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
      <div className="main-container" style={{ background: `url(${images.background})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
        <img alt="logo" src={images.logo} className="login-logo" />
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'row', alignItems: 'stretch', justifyContent: 'center', gap: '1.4rem' }}>
          <div className="mainpage-container" style={{ position: 'relative', inset: 'auto', margin: 0, backgroundColor: 'rgba(71, 76 ,70, 0.7)', backgroundImage: 'none', width: '47.4rem', height: '52.35rem' }}>
            <div className="normal-row">
              <div className="row">
                <img alt="back" src={images.icon_back} onClick={() => navigate(-1)} title="返回" />
                <span style={{ fontSize: '1.45rem' }}>入梦</span>
              </div>
              <div className="row">
                <div style={{ background: 'rgb(91,95,91)', marginRight: '1rem', borderRadius: '5rem', height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img alt="model" src={iconSystemModel} title="叙述人" style={{ marginRight: '0' }} />
                  <span style={{ fontSize: '0.8rem', marginRight: '0.5rem', marginLeft: '0.5rem' }}>{`${currentModuleName}（剩余次数：${remainTime}）`}</span>
                </div>
                <img alt="setting" src={images.setting} title="设置" />
                <img alt="help" src={images.question} title="产品帮助" onClick={() => setShowHelp(true)} />
              </div>
            </div>
            <div ref={mainscroll} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', overflow: 'auto', flex: 1, width: '100%', marginTop: '1rem', marginBottom: '-3rem' }}>
              {messageList.map((item, index) => {
                if (item.character !== 'me' && item.func === 'image') {
                  return <LeftImageMessage key={`${item.character}-${index}`} image={item.message} speakerName={getLeftSpeakerName(item)} onShowImage={setShowImage} />;
                }
                if (item.character !== 'me') {
                  return <LeftChatMessage key={`${item.character}-${index}`} message={item.message} speakerName={getLeftSpeakerName(item)} />;
                }
                return <RightChatMessage key={`${item.character}-${index}`} message={item.message} characterName={characterName} image={characterInfo?.image} />;
              })}
              {waitingMessage && <img alt="waiting" src={waitingImage} style={{ width: '4rem' }} />}
            </div>
            <div className="save_btn" style={{ bottom: 'calc(34rem - 33.9rem - 1.7rem - 2rem)', position: 'relative' }}>
              <div className="messageSendBar">
                <div className="buttonContainer">
                  <div style={{ marginRight: '0.5rem' }}>
                    <img alt="language" src={images.icon_language} />
                  </div>
                  <div className="buttonInfoContainer">
                    <span style={{ width: '3.5rem', textAlign: 'center' }}> 语音 </span>
                  </div>
                </div>
                <div className="buttonContainer" style={{ marginLeft: '2rem', marginRight: '2rem' }}>
                  <Input.TextArea autoSize={{ maxRows: 4 }} placeholder="请尽情探索吧" className="buttonInfoContainer" onKeyDown={(event) => {
                    if (event.shiftKey && event.key === 'Enter') {
                      event.preventDefault();
                      handleSend();
                    }
                  }} value={inputMessage} onChange={(event) => setInputMessage(event.target.value)} style={{ width: '19rem', color: '#fff' }} />
                </div>
                <div className="buttonContainer" onClick={handleSend}>
                  <div className="buttonInfoContainer">
                    <span style={{ width: '3.5rem', textAlign: 'center' }}> 发送 </span>
                  </div>
                  <div style={{ marginLeft: '0.5rem' }}>
                    <img alt="send" src={images.icon_send_message} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ position: 'relative', width: '25.8rem', height: '52.35rem', background: 'rgba(71, 76 ,70, 0.7)', border: '0.7px solid rgb(131, 111, 108)', borderRadius: '2rem', display: 'flex', padding: '2rem', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'stretch' }}>
            <div className="normal-row">
              <div className="row">
                <span style={{ fontSize: '1.45rem', color: '#fff' }}>旅程看板</span>
              </div>
              <div className="row">
                <img alt="help" src={images.question} title="产品帮助" style={{ marginRight: 0 }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, gap: '1rem', marginTop: '1.2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1.2 1 0', background: 'rgba(33,33,33,0.3)', borderRadius: '1rem', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, textAlign: 'left' }}>背包</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '0.2rem' }}>
                    {backpackTabs.map((tab) => (
                      <span
                        key={tab.key}
                        onClick={() => setActiveBackpackTab(tab.key)}
                        style={{ color: '#fff', fontSize: '0.7rem', borderRadius: '0.8rem', padding: '0.32rem 0.58rem', cursor: 'pointer', background: activeBackpackTab === tab.key ? 'rgba(255,255,255,0.18)' : 'transparent', whiteSpace: 'nowrap' }}
                      >
                        {tab.label}
                      </span>
                    ))}
                  </div>
                </div>
                {pendingBackpackAction && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', marginTop: '0.7rem', padding: '0.6rem 0.7rem', borderRadius: '0.8rem', background: 'rgba(73, 165, 98, 0.18)', border: '1px solid rgba(73, 165, 98, 0.28)' }}>
                    <span style={{ minWidth: 0, color: 'rgba(255,255,255,0.85)', fontSize: '0.74rem', textAlign: 'left', wordBreak: 'break-all' }}>
                      {`${pendingBackpackAction.action === 'drop' ? '丢弃' : '使用'}：${getBackpackItemLabel(pendingBackpackAction.item)}`}
                    </span>
                    <span onClick={() => setPendingBackpackAction(null)} style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', cursor: 'pointer', flexShrink: 0 }}>取消</span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', overflow: 'auto', minHeight: 0, marginTop: '0.8rem', paddingRight: '0.15rem' }}>
                  {visibleBackpackList.filter(Boolean).map((item, index) => {
                    const selected = pendingBackpackAction?.item === item;

                    return (
                      <div key={`backpack-${activeBackpackTab}-${index}`} style={{ color: '#fff', background: selected ? 'rgba(73, 165, 98, 0.16)' : 'rgba(255,255,255,0.07)', border: selected ? '1px solid rgba(73, 165, 98, 0.35)' : '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', padding: '0.75rem 0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, gap: '0.4rem' }}>
                          <span style={{ color: '#fff', fontSize: '0.82rem', lineHeight: 1.45, textAlign: 'left', wordBreak: 'break-all' }}>{getBackpackItemLabel(item)}</span>
                          {item.source && <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.66rem', lineHeight: 1, background: item.source === '剧情获取' ? 'rgba(73, 165, 98, 0.28)' : 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.8rem', padding: '0.28rem 0.5rem', whiteSpace: 'nowrap' }}>{item.source}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                          <span onClick={() => setPendingBackpackAction({ action: 'use', item })} style={{ color: '#fff', fontSize: '0.72rem', background: 'rgba(28, 122, 59, 0.88)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.8rem', padding: '0.36rem 0.62rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>使用</span>
                          <span onClick={() => setPendingBackpackAction({ action: 'drop', item })} style={{ color: '#fff', fontSize: '0.72rem', background: 'rgba(148, 91, 39, 0.82)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.8rem', padding: '0.36rem 0.62rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>丢弃</span>
                        </div>
                      </div>
                    );
                  })}
                  {!visibleBackpackList.length && <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', marginTop: '1rem', textAlign: 'left' }}>暂无物品</span>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 1 0', background: 'rgba(33,33,33,0.3)', borderRadius: '1rem', padding: '1rem' }}>
                <span style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, textAlign: 'left' }}>剧情概述</span>
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'auto', minHeight: 0, marginTop: '0.5rem', gap: '0.7rem' }}>
                  {storyOverviewList.filter(Boolean).map((item, index) => (
                    <span key={`overview-${index}`} style={{ color: index < 2 ? '#fff' : 'rgba(255,255,255,0.72)', fontSize: '0.85rem', lineHeight: 1.55, textAlign: 'left', wordBreak: 'break-all' }}>{item}</span>
                  ))}
                  {!storyOverviewList.length && <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', textAlign: 'left' }}>暂无剧情进展</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
        <img alt="eng-logo" src={images.eng_logo} className="login-eng-logo" />
        <AidrIntroduction />
      </div>
      {showHelp && <HelpDialog id="help_continue_play" onClose={() => setShowHelp(false)} />}
      <ImageLightbox image={showImage} onClose={() => setShowImage('')} />
    </>
  );
}
