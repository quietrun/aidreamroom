import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/index.scss';
import { images, firstLogin, helpDialogConfig } from '../constant';
import { HelpDialog } from '../components/common/HelpDialog';
import { ensureUserInfo, getCachedUserInfo } from '../utils/session';

const disabledMainEntryStyle = {
  filter: 'grayscale(1)',
  opacity: 0.42,
  cursor: 'not-allowed',
};

const disabledMainEntryInfoStyle = {
  background: 'rgba(70,70,70,0.72)',
  borderColor: 'rgba(115,115,115,0.8)',
};

export function MainPage() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(firstLogin && helpDialogConfig.help_main.flag);
  const [userInfo, setUserInfo] = useState(() => getCachedUserInfo() || {});

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

  return (
    <div className="main-container">
      <img alt="logo" className="login-logo" src={images.logo} />
      <div style={{ width: '31rem', minHeight: '8.8rem', borderRadius: '1.4rem', border: '1px solid rgba(185, 172, 153, 0.28)', position: 'absolute', right: '2.3rem', top: '2.1rem', background: 'linear-gradient(180deg, rgba(58, 57, 53, 0.82), rgba(34, 34, 32, 0.78))', boxShadow: '0 1.1rem 2.4rem rgba(0,0,0,0.24)', backdropFilter: 'blur(10px)', padding: '1.15rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
        <img alt="avatar" src={images.avater} style={{ width: '5.4rem', height: '5.4rem', borderRadius: '5.4rem', border: '1px solid rgba(255,255,255,0.32)', boxShadow: '0 0.45rem 1.2rem rgba(0,0,0,0.25)', flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ color: '#fff', fontSize: '1.5rem', lineHeight: 1.2, fontWeight: 600, maxWidth: '13rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userInfo.user_name}</span>
              <span style={{ color: 'rgba(232,224,211,0.62)', fontSize: '0.78rem', marginTop: '0.35rem' }}>梦境访客</span>
            </div>
            <span style={{ color: 'rgba(232,224,211,0.78)', fontSize: '1rem', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', paddingTop: '0.2rem' }}>{userInfo.user_id}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
            <div onClick={() => navigate('/mepage')} style={{ height: '2.45rem', borderRadius: '1.4rem', background: 'rgba(28, 122, 59, 0.88)', border: '1px solid rgba(142, 220, 151, 0.26)', display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0 0.55rem 0 1rem', cursor: 'pointer', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)' }}>
              <span style={{ color: '#fff', fontSize: '0.86rem', whiteSpace: 'nowrap' }}>我的角色</span>
              <span style={{ width: '1.65rem', height: '1.65rem', borderRadius: '1.65rem', background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img alt="start" src={images.icon_start} style={{ width: '1rem', height: '1rem', margin: 0 }} />
              </span>
            </div>
            <div onClick={() => navigate('/account')} style={{ height: '2.45rem', borderRadius: '1.4rem', background: 'rgba(88, 88, 82, 0.88)', border: '1px solid rgba(225, 216, 190, 0.2)', display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0 0.55rem 0 1rem', cursor: 'pointer', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)' }}>
              <span style={{ color: '#fff', fontSize: '0.86rem', whiteSpace: 'nowrap' }}>账号管理</span>
              <span style={{ width: '1.65rem', height: '1.65rem', borderRadius: '1.65rem', background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img alt="start" src={images.icon_start} style={{ width: '1rem', height: '1rem', margin: 0 }} />
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="mainpage-container">
        <div className="normal-row">
          <span>AI Dreamroom Beta 0.9.2 欢迎加入交流QQ群 271523919</span>
          <div className="row">
            {/* <img alt="avatar" src={images.avater} onClick={() => navigate('/mepage')} title="个人中心" />
            <img alt="setting" src={images.setting} onClick={() => navigate('/account')} title="账号管理" /> */}
            <img alt="help" src={images.question} title="产品帮助" onClick={() => setShowHelp(true)} />
          </div>
        </div>
        <div className="normal-row" style={{ justifyContent: 'center' }}>
          <div className="button-group" style={disabledMainEntryStyle}>
            <img alt="join" src={images.join} />
            <div className="info-text" style={disabledMainEntryInfoStyle}>
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
          <div className="button-group" style={disabledMainEntryStyle}>
            <img alt="make" src={images.make} />
            <div className="info-text" style={disabledMainEntryInfoStyle}>
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
