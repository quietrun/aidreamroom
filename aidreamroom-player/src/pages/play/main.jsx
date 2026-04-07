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

export function PlayMainPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [showHelp, setShowHelp] = useState(helpDialogConfig.help_continue_play.flag && firstLogin);
  const [showImage, setShowImage] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [selectTab, setSelectTab] = useState(1);
  const mainscroll = useRef(null);
  const { characterInfo, messageList, boardList, currentModuleName, waitingMessage, waitingImage, remainTime, sendMessage } = usePlaySession({
    gameId: id,
    socketUrl: 'ws://localhost:3300/',
  });

  const characterName = useMemo(() => characterInfo?.info?.name || '', [characterInfo]);

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
    if (sendMessage(inputMessage)) {
      setInputMessage('');
    }
  };

  return (
    <>
      <div className="main-container" style={{ background: `url(${images.background})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
        <img alt="logo" src={images.logo} className="login-logo" />
        <div className="mainpage-container" style={{ backgroundColor: 'rgba(71, 76 ,70, 0.7)', backgroundImage: 'none', width: '47.4rem', height: '52.35rem' }}>
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
                return <LeftImageMessage key={`${item.character}-${index}`} image={item.message} onShowImage={setShowImage} />;
              }
              if (item.character !== 'me') {
                return <LeftChatMessage key={`${item.character}-${index}`} message={item.message} />;
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
        <div style={{ position: 'absolute', width: '20.9rem', height: '33.8rem', background: 'rgba(71, 76 ,70, 0.7)', right: '5rem', top: '5.5rem', borderRadius: '2rem', display: 'flex', padding: '2rem', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center' }}>
          <div className="normal-row">
            <div className="row">
              <span style={{ fontSize: '1.45rem', color: '#fff' }}>旅程看板</span>
            </div>
            <div className="row">
              <img alt="help" src={images.question} title="产品帮助" />
            </div>
          </div>
          <div style={{ width: '90%' }}>
            <div className="selector-container">
              <span className={`selector-item ${selectTab === 1 ? 'selected' : ''}`} onClick={() => setSelectTab(1)}>所持物品</span>
              <span className={`selector-item ${selectTab === 2 ? 'selected' : ''}`} onClick={() => setSelectTab(2)}>「剧情」任务目标</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', overflow: 'auto', flex: 1, width: '100%' }}>
            {(boardList[selectTab - 1] || []).filter(Boolean).map((item, index) => (
              <div key={`${selectTab}-${index}`} style={{ display: 'flex', flexDirection: 'row', width: '95%', padding: '1rem 0rem 1rem 1rem', color: '#fff', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '0.85rem', background: 'rgba(33,33,33,0.6)', borderRadius: '1rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span style={{ color: '#fff', fontSize: '0.85rem', textAlign: 'left', width: '16rem', wordBreak: 'break-all' }}>{item}</span>
                </div>
                <img alt="item" src={images.icon_play_item} style={{ width: '2.2rem', height: '2.2rem', marginRight: '1rem' }} />
              </div>
            ))}
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
