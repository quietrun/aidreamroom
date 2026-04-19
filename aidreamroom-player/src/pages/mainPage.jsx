import { useEffect, useState } from 'react';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import '../styles/index.scss';
import { clearLogin } from '../function/loginCheck';
import { images, firstLogin, helpDialogConfig } from '../constant';
import { HelpDialog } from '../components/common/HelpDialog';
import { ensureUserInfo, getCachedUserInfo } from '../utils/session';

export function MainPage() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(firstLogin && helpDialogConfig.help_main.flag);
  const [userInfo, setUserInfo] = useState(() => getCachedUserInfo() || {});
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const result = await ensureUserInfo();
      if (mounted) {
        setUserInfo(result || {});
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const logout = () => {
    const current = Date.now();
    if (current - timer > 3000) {
      message.info('再次点击注销账号', 3);
      setTimer(current);
      return;
    }
    clearLogin({ clearStorage: true });
    try {
      const len = window.history.length - 1;
      window.history.go(-len);
      navigate('/', { replace: true });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="main-container">
      <img alt="logo" className="login-logo" src={images.logo} />
      <div style={{ width: '29.35rem', height: '10.75rem', borderRadius: '1rem', border: '0.2rem solid rgb(30,30,30)', position: 'absolute', right: '2rem', top: '2rem', background: 'rgba(44,44,44 , 0.8)' }}>
        <div style={{ width: '90%', height: '90%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-end', padding: '1rem' }}>
          <span style={{ color: '#fff', fontSize: '1.7rem', alignSelf: 'flex-start' }}>{userInfo.user_name}</span>
          <span style={{ color: 'rgb(186,179,166)', fontSize: '1.7rem' }}>{userInfo.user_id}</span>
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
            <div className="messageSendBar" style={{ marginLeft: '3rem', cursor: 'pointer' }}>
              <div className="buttonContainer" style={{ backgroundColor: 'rgba(1, 109, 29, 0.9)' }} onClick={() => navigate('/mepage')}>
                <div style={{ marginRight: '0.5rem' }}>
                  <img alt="start" src={images.icon_start} />
                </div>
                <div className="buttonInfoContainer" style={{ backgroundColor: 'rgba(37, 129, 51, 0.9)', border: 'none' }}>
                  <span style={{ width: '8rem', textAlign: 'center', color: '#fff', fontSize: '0.95rem' }}>查看完整信息</span>
                </div>
              </div>
            </div>
            <div className="messageSendBar" style={{ margin: '0rem', cursor: 'pointer' }}>
              <div className="buttonContainer" style={{ backgroundColor: 'rgba(144,22,15, 0.9)', border: 'none' }} onClick={logout}>
                <div className="buttonInfoContainer" style={{ backgroundColor: 'rgba(169,50,41, 0.9)' }}>
                  <span style={{ width: '4rem', textAlign: 'center', color: '#fff', fontSize: '0.95rem' }}>注销</span>
                </div>
                <div style={{ marginLeft: '0.5rem' }}>
                  <img alt="start" src={images.icon_start} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <img alt="avatar" src={images.avater} style={{ width: '5.9rem', height: '5.9rem', borderRadius: '5.9rem', position: 'absolute', left: '-2.5rem', bottom: '-2.5rem' }} />
      </div>
      <div className="mainpage-container">
        <div className="normal-row">
          <span>AI Dreamroom Beta 0.9.2 欢迎加入交流QQ群 271523919</span>
          <div className="row">
            <img alt="avatar" src={images.avater} onClick={() => navigate('/mepage')} title="个人中心" />
            <img alt="setting" src={images.setting} onClick={logout} title="双击注销" />
            <img alt="help" src={images.question} title="产品帮助" onClick={() => setShowHelp(true)} />
          </div>
        </div>
        <div className="normal-row" style={{ justifyContent: 'center' }}>
          <div className="button-group" onClick={() => navigate('/mepage')}>
            <img alt="join" src={images.join} />
            <div className="info-text">
              <span>查看角色档案与冒险记录</span>
              <img alt="entry" src={images.entry_cycle} />
            </div>
          </div>
          <div className="button-group" onClick={() => navigate('/entrydream')}>
            <img alt="play" src={images.play} />
            <div className="info-text">
              <span>即刻开始 梦幻旅程</span>
              <img alt="entry" src={images.entry_cycle} />
            </div>
          </div>
          <div className="button-group" onClick={() => navigate('/warehouse')}>
            <img alt="make" src={images.make} />
            <div className="info-text">
              <span>整理仓库、技能与开局装备</span>
              <img alt="entry" src={images.entry_cycle} />
            </div>
          </div>
        </div>
        <img alt="grey-logo" src={images.grey_logo} style={{ marginTop: '2rem' }} />
      </div>
      <img alt="eng-logo" className="login-eng-logo" src={images.eng_logo} />
      {showHelp && <HelpDialog id="help_main" onClose={() => setShowHelp(false)} />}
    </div>
  );
}
