import { useEffect, useMemo, useState } from 'react';
import { Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import '../styles/index.scss';
import cancelButton from '../assets/cancel-button.png';
import { images } from '../../constant';
import { summarizeWarehouse } from '../../constant/item';
import { computeRoleDerivedStats, getDisplayGender } from '../../constant/userRole';
import { API } from '../../utils/API';
import {
  ensureRoleProfile,
  ensureUserDetail,
  ensureWarehouseProfile,
  getCachedRoleProfile,
  getCachedUserDetail,
  getCachedWarehouseProfile,
} from '../../utils/session';

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

function ActionTile({ icon, title, subtitle, tone, onClick }) {
  return (
    <button type="button" className={`mobile-dream-home__actioncard tone-${tone}`} onClick={onClick}>
      <span className="mobile-dream-home__actionicon">
        <img alt="" src={icon} />
      </span>
      <strong>{title}</strong>
      <em>{subtitle}</em>
    </button>
  );
}

function StatCard({ label, value, suffix = '' }) {
  return (
    <div className="mobile-dream-home__statcard">
      <span>{label}</span>
      <strong>
        {value}
        {suffix ? <em>{suffix}</em> : null}
      </strong>
    </div>
  );
}

export function MobileMainPage() {
  const navigate = useNavigate();
  const cachedRoleResponse = getCachedRoleProfile();
  const cachedUserDetail = getCachedUserDetail();
  const cachedWarehouseProfile = getCachedWarehouseProfile();
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(!(cachedRoleResponse && cachedUserDetail && cachedWarehouseProfile));
  const [role, setRole] = useState(cachedRoleResponse?.role || null);
  const [detail, setDetail] = useState(cachedUserDetail || null);
  const [warehouseProfile, setWarehouseProfile] = useState(cachedWarehouseProfile || null);
  const [latestGame, setLatestGame] = useState(null);
  const [latestPlotName, setLatestPlotName] = useState('');
  const [latestCharacterName, setLatestCharacterName] = useState('');
  const [remainingTimes, setRemainingTimes] = useState('--');

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [roleResponse, nextDetail, nextWarehouseProfile, latestResult, remainResult] = await Promise.all([
          ensureRoleProfile(),
          ensureUserDetail(),
          ensureWarehouseProfile(),
          API.PLAT_LATEST_GAME(),
          API.PLAY_QUERY_TIMES_REMAIN(),
        ]);

        if (!mounted) {
          return;
        }

        if (!roleResponse?.role) {
          navigate('/mobile/role/create', { replace: true });
          return;
        }

        setRole(roleResponse.role);
        setDetail(nextDetail || null);
        setWarehouseProfile(nextWarehouseProfile || null);
        setLatestGame(latestResult?.game || null);
        setLatestPlotName(latestResult?.plot?.title || '');
        setLatestCharacterName(parseCharacterName(latestResult?.character?.info));
        setRemainingTimes(formatRemainingTimes(remainResult?.config));
      } catch (error) {
        console.error(error);
        if (mounted) {
          message.error('移动端主页加载失败');
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
  }, [navigate]);

  const derivedStats = useMemo(() => (role ? (role.derived || computeRoleDerivedStats(role)) : null), [role]);
  const warehouseSummary = useMemo(() => summarizeWarehouse(warehouseProfile), [warehouseProfile]);
  const playedCount = detail?.play?.length || 0;
  const latestGameProgress = normalizeProgressPercent(latestGame);
  const hasLatestGame = Boolean(latestGame?.uuid);
  const roleName = role?.name || latestCharacterName || '未命名角色';
  const lastPlotText = latestPlotName || '尚未开始';
  const progressText = latestGameProgress !== null ? `${latestGameProgress}% 进度` : hasLatestGame ? '进行中' : '暂无存档';
  const progressWidth = latestGameProgress !== null ? `${latestGameProgress}%` : hasLatestGame ? '56%' : '0%';
  const roleMeta = role ? `${getDisplayGender(role.gender)}·${role.age}岁` : '角色待命';

  if (loading) {
    return (
      <div className="mobile-app">
        <div className="main-container mobile-dream-home" style={{ backgroundImage: `url(${images.bg_entry})` }}>
          <div className="mobile-dream-home__scroll" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
            <Spin />
          </div>
        </div>
      </div>
    );
  }

  if (!role) {
    return null;
  }

  return (
    <div className="mobile-app">
      <div className="main-container mobile-dream-home" style={{ backgroundImage: `url(${images.bg_entry})` }}>
        <div className="mobile-dream-home__scroll">
          <header className="mobile-dream-home__header">
            <span className="mobile-dream-home__brand">AI梦之家</span>
            <button type="button" className="mobile-dream-home__ghostbutton" onClick={() => navigate('/mobile/account')}>
              设置
            </button>
          </header>

          <section className="mobile-dream-home__hero">
            <div className="mobile-dream-home__herohead">
              <div>
                <span className="mobile-dream-home__caption">当前角色</span>
                <h1>{roleName}</h1>
              </div>
              <img alt="avatar" className="mobile-dream-home__avatar" src={images.avater} />
            </div>

            <div className="mobile-dream-home__badges">
              <span>{roleMeta}</span>
              <span>{`HP ${derivedStats?.maxHp ?? '--'}`}</span>
              <span>{`MP ${derivedStats?.maxMp ?? '--'}`}</span>
              <span>{`经验 ${role.experience ?? 0}`}</span>
            </div>

            <div className="mobile-dream-home__progresscard">
              <div className="mobile-dream-home__progressrow">
                <span>上次剧本</span>
                <strong>{lastPlotText}</strong>
              </div>
              <div className="mobile-dream-home__progresstrack">
                <i style={{ width: progressWidth }} />
              </div>
              <div className="mobile-dream-home__progressmeta">{progressText}</div>
            </div>
          </section>

          <section className="mobile-dream-home__actiongrid">
            <ActionTile
              icon={images.icon_dream_selecter}
              title="立即入梦"
              subtitle={hasLatestGame ? '继续上次' : '开启旅程'}
              tone="green"
              onClick={() => navigate('/mobile/entrydream-v2')}
            />
            <ActionTile
              icon={images.icon_character}
              title="角色详情"
              subtitle={roleName}
              tone="amber"
              onClick={() => navigate('/mobile/mepage')}
            />
            <ActionTile
              icon={images.icon_cart}
              title="背包仓库"
              subtitle={`${warehouseSummary.usedSlots}/${warehouseSummary.capacity} 已用`}
              tone="violet"
              onClick={() => navigate('/mobile/warehouse')}
            />
          </section>

          <section className="mobile-dream-home__statsgrid">
            <StatCard label="剩余次数" value={remainingTimes === '无限' ? '无限' : remainingTimes.replace('次', '')} suffix={remainingTimes === '无限' ? '' : '次'} />
            <StatCard label="已玩剧本" value={playedCount} suffix="个" />
            <StatCard label="上次剧本" value={hasLatestGame ? '继续中' : '暂无'} />
          </section>

          {!hidden ? (
            <section className="mobile-dream-home__notice">
              <div>
                <strong>欢迎加入 AI梦之家</strong>
                <span>交流QQ群 271523919</span>
              </div>
              <button
                type="button"
                className="mobile-dream-home__noticeclose"
                onClick={() => setHidden(true)}
                style={{ backgroundImage: `url(${cancelButton})` }}
                aria-label="关闭公告"
              />
            </section>
          ) : null}

          <div className="mobile-dream-home__version">AI Dreamroom Beta 0.9.2</div>
        </div>
      </div>
    </div>
  );
}
