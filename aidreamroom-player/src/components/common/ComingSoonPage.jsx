import '../../styles/index.scss';
import { images } from '../../constant';

export function ComingSoonPage({ title, mobile = false }) {
  return (
    <div className="main-container">
      {!mobile && <img alt="logo" className="login-logo" src={images.logo} />}
      <div
        className="mainpage-container"
        style={mobile ? { width: '16rem', height: '18rem' } : undefined}
      >
        <div className="normal-row">
          <span>{title}</span>
        </div>
        <div
          style={{
            color: '#fff',
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            opacity: 0.8,
            whiteSpace: 'pre-line',
          }}
        >
          本页功能正在迁移到 React。
          {'\n'}
          路由、数据、接口和样式已基本接通，页面逻辑会按原项目逐步补齐。
        </div>
      </div>
      {!mobile && <img alt="eng-logo" className="login-eng-logo" src={images.eng_logo} />}
    </div>
  );
}
