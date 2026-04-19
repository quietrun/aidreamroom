import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import '../styles/index.scss';
import cancelButton from '../assets/cancel-button.png';
import { images } from '../../constant';

export function MobileMainPage() {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);

  return (
    <div className="mobile-app">
      <div className="main-container">
        <div className="mainpage-container">
          <div className="normal-row" style={{ marginTop: '0.719rem' }}>
            <span style={{ marginLeft: '0.844rem', fontSize: '0.719rem' }}>
              AI Dreamroom Beta 0.9.2
            </span>
            <div className="row">
              <img
                alt="me"
                src={images.avater}
                style={{ marginRight: '0.375rem', borderRadius: '1.375rem' }}
                onClick={() => navigate('/mobile/account')}
              />
              <img
                alt="question"
                src={images.question}
                style={{ marginLeft: '0.5rem', marginRight: '0.688rem' }}
                onClick={() =>
                  window.open('https://www.bilibili.com/video/BV1WF4m1L72W/')
                }
              />
            </div>
          </div>

          {!hidden && (
            <div>
              <img
                alt="aidr-women"
                className="login-adir-woman"
                src={images.aidr_women}
              />
              <div className="aidr-qq">
                <span
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '0.844rem',
                    fontSize: '0.531rem',
                  }}
                >
                  欢迎加入 交流QQ群{' '}
                  <a
                    href="http://qm.qq.com/cgi-bin/qm/qr?_wv=1027&k=q3Ld47IviTVj2jjk2PEv84xKWbA_mknw&authKey=vfoPhqrSaBUAt8xMNT3kx5v8BxQkTh1ClM1oIesLAoroWVQNOIK%2FYbntQots4NAO&noverify=0&group_code=271523919"
                    target="_blank"
                    rel="noreferrer"
                  >
                    271523919
                  </a>
                </span>
                <span
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '1.594rem',
                    fontSize: '0.469rem',
                    opacity: '0.4',
                  }}
                >
                  欢迎来到 AI梦之家
                </span>
                <div
                  style={{
                    width: '1rem',
                    height: '1rem',
                    position: 'absolute',
                    right: '0.563rem',
                    top: '1rem',
                    backgroundImage: `url(${cancelButton})`,
                    backgroundSize: 'contain',
                    backgroundPosition: 'center center',
                  }}
                  onClick={() => setHidden(true)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
