import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/index.scss';
import { images, firstLogin, helpDialogConfig } from '../constant';
import { HelpDialog } from '../components/common/HelpDialog';
import { ensureRoleProfile, ensureUserInfo, getCachedRoleProfile, getCachedUserInfo } from '../utils/session';

const GOLD = 'rgba(197,160,82,1)';
const BORDER_BASE = 'rgba(200,175,140,0.14)';
const TEXT_FAINT = 'rgba(246,239,226,0.36)';

function ArrowRight({ size = 9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function LiveDot() {
  return (
    <div className="main-entry-live">
      <span />
      <b>可用</b>
    </div>
  );
}

function EntryCard({ img, desc, cta, enabled, live, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={enabled ? onClick : undefined}
      onMouseEnter={() => enabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`main-entry-card${enabled ? ' is-enabled' : ' is-disabled'}`}
      style={{
        borderColor: hovered ? 'rgba(197,160,82,0.45)' : BORDER_BASE,
        cursor: enabled ? 'pointer' : 'not-allowed',
        filter: enabled ? 'none' : 'grayscale(0.85)',
        opacity: enabled ? 1 : 0.45,
        transform: hovered ? 'translateY(-8px) scale(1.018)' : 'translateY(0) scale(1)',
        boxShadow: hovered
          ? '0 28px 72px rgba(0,0,0,0.6), 0 0 0 1px rgba(197,160,82,0.12), inset 0 1px 0 rgba(197,160,82,0.12)'
          : '0 8px 24px rgba(0,0,0,0.3)',
      }}
    >
      {/* {live && enabled && <LiveDot />} */}
      <img
        alt={cta}
        src={img}
        className="main-entry-card__image"
        style={{
          filter: hovered ? 'brightness(0.96) saturate(1)' : 'brightness(0.88) saturate(0.92)',
          transform: hovered ? 'scale(1.04)' : 'scale(1)',
        }}
      />
      <div className="main-entry-card__label">
        <span>{desc}</span>
        <div
          className="main-entry-card__button"
          style={{
            background: enabled && hovered ? 'rgba(197,160,82,0.20)' : 'rgba(197,160,82,0.12)',
            borderColor: enabled && hovered ? 'rgba(197,160,82,0.42)' : 'rgba(197,160,82,0.22)',
          }}
        >
          <strong style={{ color: enabled ? GOLD : TEXT_FAINT }}>{cta}</strong>
          <i style={{ transform: hovered ? 'translateX(2px)' : 'none' }}>
            <ArrowRight />
          </i>
        </div>
      </div>
    </div>
  );
}

function UserCard({ userInfo, roleInfo }) {
  const navigate = useNavigate();
  const userName = userInfo?.user_name || '梦境访客';
  const userId = userInfo?.user_id || '--';
  const roleName = roleInfo?.role?.name || '--';

  return (
    <div className="main-user-card">
      <img alt="avatar" src={images.avater} />
      <div className="main-user-card__info">
        <span>{userName}</span>
        <b>{`ID ${userId} · ${roleName}`}</b>
      </div>
      <i />
      <div className="main-user-card__actions">
        <button type="button" className="is-role" onClick={() => navigate('/mepage')}>
          我的角色
        </button>
        <button type="button" onClick={() => navigate('/account')}>
          账号管理
        </button>
      </div>
    </div>
  );
}

export function MainPage() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(firstLogin && helpDialogConfig.help_main.flag);
  const [userInfo, setUserInfo] = useState(() => getCachedUserInfo() || {});
  const [roleResponse, setRoleResponse] = useState(() => getCachedRoleProfile() || null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [nextUser, nextRole] = await Promise.all([ensureUserInfo(), ensureRoleProfile()]);
        if (!mounted) {
          return;
        }
        setUserInfo(nextUser || {});
        setRoleResponse(nextRole || null);
      } catch (error) {
        console.error(error);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const cards = [
    {
      key: 'archive',
      img: images.join,
      desc: '查看角色档案与冒险记录',
      cta: '观看梦境',
      enabled: false,
      live: false,
      onClick: () => {},
    },
    {
      key: 'play',
      img: images.play,
      desc: '即刻开始，踏上梦幻旅程',
      cta: '立即入梦',
      enabled: true,
      live: true,
      onClick: () => navigate('/entrydream-v2'),
    },
    {
      key: 'make',
      img: images.make,
      desc: '整理仓库、技能与开局装备',
      cta: '织造梦境',
      enabled: false,
      live: false,
      onClick: () => {},
    },
  ];

  return (
    <div className="main-container desktop-main-page" style={{ backgroundImage: `url(${images.background})` }}>
      <style>{`
        @keyframes mainPulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
      `}</style>

      <div className="desktop-main-page__shade" />
      <div className="desktop-main-page__topshade" />
      <div className="desktop-main-page__bottomshade" />

      <header className="desktop-main-page__topbar">
        <div className="desktop-main-page__brand">
          <span>AI Dreamroom · 梦之家</span>
          <b>Beta 1.0.0.20260504 · 欢迎加入交流 QQ 群 271523919</b>
        </div>
        <div className="desktop-main-page__userwrap">
          <UserCard userInfo={userInfo} roleInfo={roleResponse} />
          <button type="button" title="产品帮助" className="desktop-main-page__help" onClick={() => setShowHelp(true)}>
            <img alt="help" src={images.question} />
          </button>
        </div>
      </header>

      <main className="desktop-main-page__center">
        <span className="desktop-main-page__eyebrow">AI Dreamroom · 入梦系统</span>
        <h1>选择你的旅程入口</h1>
        <section className="desktop-main-page__cards" aria-label="旅程入口">
          {cards.map((card) => (
            <EntryCard key={card.key} {...card} />
          ))}
        </section>
      </main>

      {showHelp && <HelpDialog id="help_main" onClose={() => setShowHelp(false)} />}
    </div>
  );
}
