import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/index.scss';
import { images } from '../constant';
import { DesktopUserFloatingCard } from '../components/common/DesktopUserFloatingCard';
import { API } from '../utils/API';
import { ensureRoleProfile, getCachedRoleProfile } from '../utils/session';

function parseCharacterName(info) {
  if (!info) {
    return '';
  }

  try {
    return JSON.parse(info)?.name || '';
  } catch (error) {
    return '';
  }
}

function formatRemainingTimes(config) {
  const entries = Array.isArray(config) ? config : [];

  if (!entries.length) {
    return '--';
  }

  if (entries.some((item) => item?.times === '无限')) {
    return '无限';
  }

  const total = entries.reduce((sum, item) => {
    const value = Number(item?.times);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);

  return total > 0 ? `${total}次` : '0次';
}

export function EntryDreamV2Page() {
  const navigate = useNavigate();
  const cachedRoleProfile = getCachedRoleProfile();
  const [latestGame, setLatestGame] = useState(null);
  const [currentCharacterName, setCurrentCharacterName] = useState(cachedRoleProfile?.role?.name || '未命名角色');
  const [latestCharacterName, setLatestCharacterName] = useState('');
  const [plotName, setPlotName] = useState('');
  const [remainingTimes, setRemainingTimes] = useState('--');

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [latestResult, remainResult, roleProfile] = await Promise.all([
          API.PLAT_LATEST_GAME(),
          API.PLAY_QUERY_TIMES_REMAIN(),
          ensureRoleProfile(),
        ]);

        if (!mounted) {
          return;
        }

        const nextLatestCharacterName = parseCharacterName(latestResult?.character?.info);
        const nextCurrentCharacterName = nextLatestCharacterName || roleProfile?.role?.name || '未命名角色';

        setLatestGame(latestResult?.game || null);
        setLatestCharacterName(nextLatestCharacterName);
        setCurrentCharacterName(nextCurrentCharacterName);
        setPlotName(latestResult?.plot?.title || '');
        setRemainingTimes(formatRemainingTimes(remainResult?.config));
      } catch (error) {
        console.error(error);

        if (mounted) {
          setCurrentCharacterName(cachedRoleProfile?.role?.name || '未命名角色');
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [cachedRoleProfile]);

  const hasLatestGame = Boolean(latestGame?.uuid);
  const lastPlotText = plotName || '尚未开始';
  const lastCharacterText = latestCharacterName || currentCharacterName || '未命名角色';

  return (
    <div className="main-container entrydream-v2-page" style={{ backgroundImage: `url(${images.bg_entry})` }}>
      <img alt="logo" src={images.logo} className="login-logo" />
      {/* <DesktopUserFloatingCard /> */}

      <main className="entrydream-v2-shell">
        <div className="entrydream-v2-eyebrow">AI Dreamroom · 入梦系统</div>
        <h1 className="entrydream-v2-title">即刻踏入梦境</h1>

        <section className="entrydream-v2-statusbar" aria-label="梦境状态">
          <div className="entrydream-v2-statusitem is-active">
            <span className="entrydream-v2-statusdot" />
            <span className="entrydream-v2-statuslabel">当前角色</span>
            <strong>{currentCharacterName}</strong>
          </div>
          <div className="entrydream-v2-statusitem">
            <span className="entrydream-v2-statuslabel">上次剧本</span>
            <strong>{lastPlotText}</strong>
          </div>
          <div className="entrydream-v2-statusitem">
            <span className="entrydream-v2-statuslabel">剩余次数</span>
            <strong className="is-accent">{remainingTimes}</strong>
          </div>
        </section>

        <section className="entrydream-v2-cardgrid">
          <button
            type="button"
            className={`entrydream-v2-card is-continue${hasLatestGame ? '' : ' is-disabled'}`}
            onClick={() => hasLatestGame && navigate(`/play/main/${latestGame.uuid}`)}
            disabled={!hasLatestGame}
          >
            <span className="entrydream-v2-tag">上次中断</span>
            <h2>继续上次梦境</h2>
            <p>
              {hasLatestGame
                ? '从你离开的地方重新踏入，记忆、物品与剧情进度都已为你完整保留，梦境正在等待。'
                : '当前还没有可继续的存档。等你完成第一次入梦后，这里会自动承接上一次旅程。'}
            </p>
            <div className="entrydream-v2-divider" />
            <div className="entrydream-v2-cardfooter">
              <div className="entrydream-v2-meta">
                <span>剧本</span>
                <strong>{lastPlotText}</strong>
              </div>
              <div className="entrydream-v2-meta">
                <span>角色</span>
                <strong>{lastCharacterText}</strong>
              </div>
              <span className="entrydream-v2-actionpill">{hasLatestGame ? '继续入梦 >' : '暂无存档'}</span>
            </div>
          </button>

          <button type="button" className="entrydream-v2-card is-start" onClick={() => navigate('/play/select')}>
            <span className="entrydream-v2-tag">全新启程</span>
            <h2>开启新的梦境</h2>
            <p>浏览剧本，配置你的仓库与装备，以新的身份踏入一段从未经历过的故事，重新开启新的梦境分支。</p>
            <div className="entrydream-v2-divider" />
            <div className="entrydream-v2-cardfooter">
              <div className="entrydream-v2-meta">
                <span>当前角色</span>
                <strong>{currentCharacterName}</strong>
              </div>
              <div className="entrydream-v2-meta">
                <span>入口</span>
                <strong>剧本选择页</strong>
              </div>
              <span className="entrydream-v2-actionpill">选择剧本 {'>'}</span>
            </div>
          </button>
        </section>
      </main>

      <div className="entrydream-v2-footer">
        <button type="button" className="entrydream-v2-footerbutton desktop-return-home-button" onClick={() => navigate('/main')}>
          返回主页
        </button>
      </div>

      <img alt="eng-logo" src={images.eng_logo} className="login-eng-logo" />
    </div>
  );
}
