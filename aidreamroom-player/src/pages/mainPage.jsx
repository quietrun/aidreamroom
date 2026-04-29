import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/index.scss';
import { images, firstLogin, helpDialogConfig } from '../constant';
import { HelpDialog } from '../components/common/HelpDialog';
import { DesktopUserFloatingCard } from '../components/common/DesktopUserFloatingCard';

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

  return (
    <div className="main-container">
      <img alt="logo" className="login-logo" src={images.logo} />
      <DesktopUserFloatingCard />
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
          <div className="button-group" onClick={() => navigate('/entrydream-v2')}>
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
