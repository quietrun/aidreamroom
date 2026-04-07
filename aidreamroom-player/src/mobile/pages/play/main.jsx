import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import '../../styles/index.scss';
import { images } from '../../../constant';
import { usePlaySession } from '../../../hooks/usePlaySession';
import { LeftChatMessage, LeftImageMessage, RightChatMessage, ImageLightbox } from '../../../components/play/ChatParts';
import iconSystemModel from '@/icon_system_model.png';

export function MobilePlayMainPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const mainscroll = useRef(null);
  const [inputMessage, setInputMessage] = useState('');
  const [showImage, setShowImage] = useState('');
  const { characterInfo, messageList, currentModuleName, waitingMessage, waitingImage, remainTime, sendMessage } = usePlaySession({
    gameId: id,
    socketUrl: 'ws://54.215.173.53:3300/',
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
    <div className="mobile-app">
      <div className="main-container" style={{ background: `url(${images.background})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
        <div className="mainpage-container" style={{ backgroundColor: 'rgba(71, 76 ,70, 0.7)', backgroundImage: 'none' }}>
          <div className="normal-row" style={{ marginTop: '0.844rem' }}>
            <div className="row">
              <img src={images.icon_back} onClick={() => navigate(-1)} style={{ marginLeft: '0.844rem', marginRight: '0.531rem' }} />
              <span style={{ fontSize: '0.719rem' }}>入梦</span>
            </div>
            <div className="row">
              <div style={{ background: 'rgb(91,95,91)', marginRight: '0.5rem', borderRadius: '1.063rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={iconSystemModel} title="叙述人" style={{ marginRight: '0' }} />
                <span style={{ fontSize: '0.6rem', marginRight: '0.5rem', marginLeft: '0.5rem' }}>{`${currentModuleName}（剩余次数：${remainTime}）`}</span>
              </div>
              <img src={images.question} onClick={() => window.open('https://www.bilibili.com/video/BV1WF4m1L72W/')} style={{ marginLeft: '0.5rem', marginRight: '0.688rem' }} />
            </div>
          </div>
          <div ref={mainscroll} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', overflow: 'auto', flex: 1, width: '100%', marginTop: '0.688rem', marginBottom: '5.4rem' }}>
            {messageList.map((item, index) => {
              if (item.character !== 'me' && item.func === 'image') {
                return <LeftImageMessage key={`${item.character}-${index}`} image={item.message} onShowImage={setShowImage} />;
              }
              if (item.character !== 'me') {
                return <LeftChatMessage key={`${item.character}-${index}`} message={item.message} mobile />;
              }
              return <RightChatMessage key={`${item.character}-${index}`} message={item.message} characterName={characterName} image={characterInfo?.image} mobile />;
            })}
            {waitingMessage && <img src={waitingImage} style={{ width: '2.844rem', marginLeft: '0.563rem' }} />}
          </div>
          <div className="save_btn">
            <div className="messageSendBar">
              <div className="buttonContainer" style={{ zIndex: '8', width: '15.75rem', height: '2.75rem', padding: '0', marginLeft: '-1.25rem', marginRight: '-1.25rem', borderRadius: '1.063rem' }}>
                <Input.TextArea autoSize={{ maxRows: 4 }} placeholder="请尽情探索吧" className="buttonInfoContainer" value={inputMessage} onChange={(event) => setInputMessage(event.target.value)} onKeyDown={(event) => {
                  if (event.shiftKey && event.key === 'Enter') {
                    event.preventDefault();
                    handleSend();
                  }
                }} style={{ width: '14.719rem', height: '1.75rem', padding: '0.563rem 0.406rem 0.5rem 0.656rem', fontSize: '0.531rem', color: '#fff' }} />
              </div>
              <div className="buttonContainer" style={{ zIndex: '10', top: '-1.531rem', position: 'relative', backgroundColor: '#005F00' }} onClick={handleSend}>
                <img src={images.icon_send_message} />
              </div>
            </div>
          </div>
        </div>
        <img src={images.eng_logo} className="login-eng-logo" />
      </div>
      <ImageLightbox image={showImage} onClose={() => setShowImage('')} />
    </div>
  );
}

