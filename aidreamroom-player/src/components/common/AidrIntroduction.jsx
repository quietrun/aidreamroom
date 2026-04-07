import { useMemo, useState } from 'react';
import { images } from '../../constant';

export function AidrIntroduction() {
  const [opacity, setOpacity] = useState(1);
  const hiddenStyle = useMemo(() => ({ opacity }), [opacity]);

  const closeIntroduction = () => {
    const timer = window.setInterval(() => {
      setOpacity((current) => {
        if (current <= 0) {
          window.clearInterval(timer);
          return 0;
        }
        return Number((current - 0.1).toFixed(2));
      });
    }, 50);
  };

  return (
    <div className="login-ad">
      <img alt="aidr" className="login-adir-woman" src={images.aidr_women} />
      <div style={{ marginLeft: '-2rem' }}>
        <div className="inductron" style={hiddenStyle}>
          <div
            style={{
              flexDirection: 'row',
              display: 'flex',
              width: '100%',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <img alt="" src={images.app_logo} style={{ width: '2.6rem', opacity: 0 }} />
            <img alt="app-logo" src={images.app_logo} style={{ width: '2.6rem' }} />
            <div onClick={closeIntroduction}>
              <img alt="close" src={images.close_button} style={{ width: '2.2rem' }} title="关闭" />
            </div>
          </div>
          <div style={{ flexDirection: 'column', display: 'flex', width: '100%', marginTop: '1rem' }}>
            <span>欢迎来到AI梦之家</span>
            <span style={{ fontSize: '0.85rem', color: 'rgba(164,153,142)' }}>
              让艾达与你一起创造精彩的旅程吧
            </span>
          </div>
          <div className="line" style={{ marginTop: '1rem' }} />
          <span style={{ marginTop: '2rem' }}>点击了解 艾达 AIDR</span>
        </div>
        <img alt="AIDR" className="login-aidr" src={images.AIDR} />
      </div>
    </div>
  );
}
