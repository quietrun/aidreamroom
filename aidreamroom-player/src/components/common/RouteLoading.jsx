import { Spin } from 'antd';
import { images } from '../../constant';

export function RouteLoading({ mobile = false, tip = '页面加载中...' }) {
  return (
    <div
      className={`route-loading-screen${mobile ? ' mobile' : ''}`}
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(18, 16, 14, 0.78), rgba(28, 23, 20, 0.92)), url(${images.background4})`,
      }}
    >
      <div className="route-loading-card">
        <img alt="logo" className="route-loading-logo" src={images.logo} />
        <Spin size={mobile ? 'default' : 'large'} />
        <div className="route-loading-text">{tip}</div>
      </div>
    </div>
  );
}
