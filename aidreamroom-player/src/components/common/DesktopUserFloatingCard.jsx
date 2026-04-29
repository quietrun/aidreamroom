import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { images } from '../../constant';
import { ensureUserInfo, getCachedUserInfo } from '../../utils/session';

const panelStyle = {
  width: '31rem',
  minHeight: '8.8rem',
  borderRadius: '1.4rem',
  border: '1px solid rgba(185, 172, 153, 0.28)',
  position: 'absolute',
  right: '2.3rem',
  top: '2.1rem',
  background: 'linear-gradient(180deg, rgba(58, 57, 53, 0.82), rgba(34, 34, 32, 0.78))',
  boxShadow: '0 1.1rem 2.4rem rgba(0,0,0,0.24)',
  backdropFilter: 'blur(10px)',
  padding: '1.15rem 1.25rem',
  display: 'flex',
  alignItems: 'center',
  gap: '1.1rem',
  zIndex: 4,
};

const actionBaseStyle = {
  height: '2.45rem',
  borderRadius: '1.4rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.45rem',
  padding: '0 0.55rem 0 1rem',
  cursor: 'pointer',
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
  transition: 'transform 0.18s ease, opacity 0.18s ease',
};

const actionCircleStyle = {
  width: '1.65rem',
  height: '1.65rem',
  borderRadius: '1.65rem',
  background: 'rgba(255,255,255,0.14)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function ActionButton({ label, tone, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        ...actionBaseStyle,
        background: tone === 'green' ? 'rgba(28, 122, 59, 0.88)' : 'rgba(88, 88, 82, 0.88)',
        border: tone === 'green' ? '1px solid rgba(142, 220, 151, 0.26)' : '1px solid rgba(225, 216, 190, 0.2)',
      }}
    >
      <span style={{ color: '#fff', fontSize: '0.86rem', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={actionCircleStyle}>
        <img alt="start" src={images.icon_start} style={{ width: '1rem', height: '1rem', margin: 0 }} />
      </span>
    </div>
  );
}

export function DesktopUserFloatingCard({ style }) {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(() => getCachedUserInfo() || {});

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const result = await ensureUserInfo();
        if (mounted) {
          setUserInfo(result || {});
        }
      } catch (error) {
        console.error(error);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ ...panelStyle, ...style }}>
      <img
        alt="avatar"
        src={images.avater}
        style={{
          width: '5.4rem',
          height: '5.4rem',
          borderRadius: '5.4rem',
          border: '1px solid rgba(255,255,255,0.32)',
          boxShadow: '0 0.45rem 1.2rem rgba(0,0,0,0.25)',
          flexShrink: 0,
        }}
      />
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span
              style={{
                color: '#fff',
                fontSize: '1.5rem',
                lineHeight: 1.2,
                fontWeight: 600,
                maxWidth: '13rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {userInfo.user_name || '梦境访客'}
            </span>
            <span style={{ color: 'rgba(232,224,211,0.62)', fontSize: '0.78rem', marginTop: '0.35rem' }}>梦境访客</span>
          </div>
          <span style={{ color: 'rgba(232,224,211,0.78)', fontSize: '1rem', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', paddingTop: '0.2rem' }}>
            {userInfo.user_id || '--'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
          <ActionButton label="我的角色" tone="green" onClick={() => navigate('/mepage')} />
          <ActionButton label="账号管理" tone="neutral" onClick={() => navigate('/account')} />
        </div>
      </div>
    </div>
  );
}
