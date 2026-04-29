import { useEffect, useState } from 'react';
import { Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import '../styles/index.scss';
import { images } from '../../constant';
import { API } from '../../utils/API';
import { ensureRoleProfile, getCachedRoleProfile } from '../../utils/session';

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

  return `${total}次`;
}

function normalizeProgressPercent(game) {
  const candidateKeys = ['progress', 'progressPercent', 'percent', 'percentage', 'completionRate'];

  for (const key of candidateKeys) {
    const value = Number(game?.[key]);
    if (Number.isFinite(value)) {
      return Math.max(0, Math.min(100, Math.round(value)));
    }
  }

  if (game?.isFinish) {
    return 100;
  }

  return null;
}

export function MobileEntryDreamV2Page() {
  const navigate = useNavigate();
  const cachedRoleResponse = getCachedRoleProfile();
  const [loading, setLoading] = useState(!cachedRoleResponse);
  const [latestGame, setLatestGame] = useState(null);
  const [currentCharacterName, setCurrentCharacterName] = useState(cachedRoleResponse?.role?.name || '未命名角色');
  const [latestCharacterName, setLatestCharacterName] = useState('');
  const [plotName, setPlotName] = useState('');
  const [remainingTimes, setRemainingTimes] = useState('--');

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [latestResult, remainResult, roleResponse] = await Promise.all([
          API.PLAT_LATEST_GAME(),
          API.PLAY_QUERY_TIMES_REMAIN(),
          ensureRoleProfile(),
        ]);

        if (!mounted) {
          return;
        }

        const nextLatestCharacterName = parseCharacterName(latestResult?.character?.info);
        setLatestGame(latestResult?.game || null);
        setLatestCharacterName(nextLatestCharacterName);
        setCurrentCharacterName(nextLatestCharacterName || roleResponse?.role?.name || '未命名角色');
        setPlotName(latestResult?.plot?.title || '');
        setRemainingTimes(formatRemainingTimes(remainResult?.config));
      } catch (error) {
        console.error(error);
        if (mounted) {
          message.error('入梦页加载失败');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const hasLatestGame = Boolean(latestGame?.uuid);
  const lastPlotText = plotName || '尚未开始';
  const lastCharacterText = latestCharacterName || currentCharacterName || '未命名角色';
  const progressPercent = normalizeProgressPercent(latestGame);
  const progressText = progressPercent !== null ? `${progressPercent}%` : hasLatestGame ? '进行中' : '--';

  if (loading) {
    return (
      <div className="mobile-app">
        <div className="main-container mobile-entrydream-page" style={{ backgroundImage: `url(${images.bg_entry})` }}>
          <div className="mobile-entrydream-page__scroll" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
            <Spin />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-app">
      <div className="main-container mobile-entrydream-page" style={{ backgroundImage: `url(${images.bg_entry})` }}>
        <div className="mobile-entrydream-page__scroll">
          <header className="mobile-entrydream-page__header">
            <button type="button" className="mobile-entrydream-page__headerbutton" onClick={() => navigate('/mobile/main')}>
              {'< 返回'}
            </button>
            <span className="mobile-entrydream-page__brand">AI梦之家</span>
            <button type="button" className="mobile-entrydream-page__headerbutton" onClick={() => navigate('/mobile/account')}>
              设置
            </button>
          </header>

          <section className="mobile-entrydream-page__hero">
            <div className="mobile-entrydream-page__eyebrow">AI 梦境 · 入梦系统</div>
            <h1 className="mobile-entrydream-page__title">即刻踏入梦境</h1>

            <div className="mobile-entrydream-page__statusbar">
              <div className="mobile-entrydream-page__statusitem is-active">
                <span className="mobile-entrydream-page__statusdot" />
                <span>当前角色</span>
                <strong>{currentCharacterName}</strong>
              </div>
              <div className="mobile-entrydream-page__statusitem">
                <span>上次剧本</span>
                <strong>{lastPlotText}</strong>
              </div>
              <div className="mobile-entrydream-page__statusitem">
                <span>剩余</span>
                <strong className="is-accent">{remainingTimes}</strong>
              </div>
            </div>
          </section>

          <section className="mobile-entrydream-page__cardlist">
            <div className={`mobile-entrydream-page__card is-continue${hasLatestGame ? '' : ' is-disabled'}`}>
              <span className="mobile-entrydream-page__tag">上次中断</span>
              <h2>继续上次梦境</h2>
              <p>
                {hasLatestGame
                  ? '从你离开的地方重新踏入，记忆、物品与剧情进度都已为你完整保留，梦境在等待。'
                  : '当前还没有可继续的梦境存档，开启一次新的旅程后，这里会自动承接你的上次进度。'}
              </p>

              <div className="mobile-entrydream-page__infobar">
                <div>
                  <span>剧本</span>
                  <strong>{lastPlotText}</strong>
                </div>
                <div>
                  <span>角色</span>
                  <strong>{lastCharacterText}</strong>
                </div>
                <div>
                  <span>进度</span>
                  <strong className="is-accent">{progressText}</strong>
                </div>
              </div>

              <button
                type="button"
                className="mobile-entrydream-page__primarybutton"
                onClick={() => hasLatestGame && navigate(`/mobile/play/main/${latestGame.uuid}`)}
                disabled={!hasLatestGame}
              >
                {hasLatestGame ? '继续入梦 >' : '暂无存档'}
              </button>
            </div>

            <div className="mobile-entrydream-page__card is-start">
              <span className="mobile-entrydream-page__tag">全新启程</span>
              <h2>开启新的梦境</h2>
              <p>随机抽取或浏览剧本，配置你的仓库与装备，以全新身份踏入一段从未经历过的故事。</p>

              <div className="mobile-entrydream-page__startfooter">
                <div>
                  <span>当前角色</span>
                  <strong>{currentCharacterName}</strong>
                </div>
                <button type="button" className="mobile-entrydream-page__secondarybutton" onClick={() => navigate('/mobile/play/select')}>
                  选择剧本 {'>'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
