import { useEffect, useMemo, useState } from 'react';
import { Modal, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import '../styles/index.scss';
import { images } from '../constant';
import {
  computeRoleAttributeTotal,
  computeRoleDerivedStats,
  getDisplayGender,
  roleAbilityDefinitions,
  roleAttributeDefinitions,
} from '../constant/userRole';
import {
  ensureRoleProfile,
  ensureUserDetail,
  getCachedRoleProfile,
  getCachedUserDetail,
  markRoleReset,
} from '../utils/session';
import { API } from '../utils/API';

const tabs = [
  { key: 'attributes', label: '九维属性' },
  { key: 'abilities', label: '能力树' },
  { key: 'records', label: '角色记录' },
];

const attributeColors = [
  '#cf7759',
  '#c69a49',
  '#c2bf58',
  '#65bd77',
  '#a66bd5',
  '#6192e4',
  '#8a6ad9',
  '#67c1c8',
  '#d5c865',
];

function ActionButton({ label, onClick, danger = false }) {
  return (
    <button className={`role-action-button ${danger ? 'danger' : ''}`} type="button" onClick={onClick}>
      {label}
    </button>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="role-stat-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyTag({ text }) {
  return <div className="role-empty-text">{text}</div>;
}

function Chip({ children, tone = 'default' }) {
  return <span className={`role-chip ${tone}`}>{children}</span>;
}

function AttributeCard({ item, value, color }) {
  const percent = Math.min(100, Math.max(0, (Number(value || 0) / 99) * 100));

  return (
    <div className="role-attribute-card">
      <div className="role-card-title-row">
        <span>{item.label}</span>
        <strong>{value}<em>/99</em></strong>
      </div>
      <div className="role-progress-track">
        <i style={{ width: `${percent}%`, background: color }} />
      </div>
      <p>{item.description}</p>
    </div>
  );
}

function AbilityCard({ item, current }) {
  const level = Math.min(10, Math.max(0, Number(current.level || 0)));

  return (
    <div className="role-ability-card">
      <div className="role-card-title-row">
        <span>{item.label}</span>
        <strong>{`Lv.${level}`}</strong>
      </div>
      <div className="role-ability-segments">
        {Array.from({ length: 10 }).map((_, index) => (
          <i key={`${item.key}-${index}`} className={index < level ? 'active' : ''} />
        ))}
      </div>
      <div className="role-ability-footer">
        <p>{item.description}</p>
        <span>{`经验 ${current.experience || 0}`}</span>
      </div>
    </div>
  );
}

function RecordGroup({ title, children }) {
  return (
    <div className="role-record-group">
      <h3>{title}</h3>
      <div className="role-record-chip-list">{children}</div>
    </div>
  );
}

export function MePage() {
  const navigate = useNavigate();
  const cachedRoleResponse = getCachedRoleProfile();
  const cachedUserDetail = getCachedUserDetail();
  const [loading, setLoading] = useState(!(cachedRoleResponse && cachedUserDetail));
  const [detail, setDetail] = useState(cachedUserDetail);
  const [role, setRole] = useState(cachedRoleResponse?.role || null);
  const [activeTab, setActiveTab] = useState('attributes');
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [nextDetail, roleResponse] = await Promise.all([
          ensureUserDetail(),
          ensureRoleProfile(),
        ]);

        if (!mounted) {
          return;
        }

        if (!roleResponse.role) {
          navigate('/role/create', { replace: true });
          return;
        }

        setDetail(nextDetail);
        setRole(roleResponse.role);
      } catch (error) {
        console.error(error);
        if (mounted) {
          message.error('个人页面加载失败');
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

  const derivedStats = useMemo(() => (role?.derived ? role.derived : computeRoleDerivedStats(role)), [role]);
  const abilityMap = useMemo(() => new Map((role?.abilities || []).map((item) => [item.abilityKey, item])), [role]);
  const attributeTotal = useMemo(() => computeRoleAttributeTotal(role || {}), [role]);
  const counts = {
    play: detail?.play?.length || 0,
    worlds: role?.worlds?.length || 0,
    items: role?.items?.length || 0,
  };

  const derivedCards = [
    ['生命上限', derivedStats.maxHp],
    ['魔法上限', derivedStats.maxMp],
    ['负重', derivedStats.carryCapacity],
    ['推举极限', derivedStats.pushLimit],
    ['伤害加值', derivedStats.damageBonus],
    ['移动速率', derivedStats.moveRate],
    ['射击加成', `+${derivedStats.shootBonus}`],
    ['社交加成', `+${derivedStats.socialBonus}`],
    ['学习加成', `+${derivedStats.learningBonus}`],
    ['幸运加成', `+${derivedStats.critBonus}`],
  ];

  const resetRole = () => {
    Modal.confirm({
      title: '确认重新生成角色？',
      content: '重新生成角色后原角色的属性，经验值，所有物品和记录会被删除，确认是否重新生成',
      okText: '确认重新生成',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        const result = await API.USER_ROLE_RESET();
        if (result?.result !== 0) {
          message.error(result?.message || '角色重置失败');
          return Promise.reject(new Error(result?.message || '角色重置失败'));
        }

        markRoleReset();
        message.success('角色已重置，请重新创建角色');
        navigate('/role/create', { replace: true });
        return undefined;
      },
    });
  };

  if (loading) {
    return (
      <div className="main-container">
        <img alt="logo" className="login-logo" src={images.logo} />
        <div className="mainpage-container" style={{ width: '26rem', height: '14rem', justifyContent: 'center' }}>
          <Spin />
        </div>
        <img alt="eng-logo" className="login-eng-logo" src={images.eng_logo} />
      </div>
    );
  }

  if (!role) {
    return null;
  }

  return (
    <div className="role-dashboard-page" style={{ backgroundImage: `url(${images.background5})` }}>
      <img alt="logo" className="role-dashboard-logo" src={images.logo} />

      <div className="role-dashboard-shell">
        <aside className="role-sidebar">
          <section className="role-profile-card">
            <div className="role-profile-head">
              <div className="role-avatar-wrap">
                <img alt="avatar" src={images.avater} />
                <i />
              </div>
              <div className="role-profile-title">
                <h1>{role.name}</h1>
                <p>{`${getDisplayGender(role.gender)} · ${role.age}岁`}</p>
                <div>
                  <Chip>{`经验 ${role.experience}`}</Chip>
                  <Chip>{`九维总值 ${attributeTotal}`}</Chip>
                </div>
              </div>
            </div>
            {showIntro && <p className="role-intro">{role.appearanceStyle || '暂未填写外观样式'}</p>}
          </section>

          <section className="role-side-card">
            <h2>战斗状态</h2>
            <div className="role-status-grid">
              <StatTile label="生命 HP" value={derivedStats.maxHp} />
              <StatTile label="魔法 MP" value={derivedStats.maxMp} />
            </div>
          </section>

          <section className="role-side-card">
            <div className="role-action-grid">
              <ActionButton label="技能库" onClick={() => navigate('/skills')} />
              <ActionButton label="物品库" onClick={() => navigate('/items')} />
              <ActionButton label="仓库" onClick={() => navigate('/warehouse')} />
              <ActionButton label="重新生成角色" onClick={resetRole} danger />
            </div>
          </section>

          <section className="role-side-card role-adventure-card">
            <h2>冒险统计</h2>
            <div className="role-adventure-grid">
              <StatTile label="剧本数" value={counts.play} />
              <StatTile label="经历世界" value={counts.worlds} />
              <StatTile label="获得物品" value={counts.items} />
            </div>
          </section>
        </aside>

        <main className="role-main-panel">
          <header className="role-main-header">
            <nav className="role-tab-list">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={activeTab === tab.key ? 'active' : ''}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            <div className="role-header-actions">
              {activeTab === 'attributes' && (
                <button type="button" onClick={() => setShowIntro((current) => !current)}>
                  {showIntro ? '收起说明' : '展开说明'}
                </button>
              )}
              <button type="button" className="back" onClick={() => navigate('/main')}>
                <span>‹</span>
                返回主页
              </button>
            </div>
          </header>

          <div className="role-main-content">
            {activeTab === 'attributes' && (
              <section>
                <h2>{`九维属性  合计 ${attributeTotal}`}</h2>
                <div className="role-attribute-grid">
                  {roleAttributeDefinitions.map((item, index) => (
                    <AttributeCard
                      key={item.key}
                      item={item}
                      value={role.attributes?.[item.key] ?? 0}
                      color={attributeColors[index % attributeColors.length]}
                    />
                  ))}
                </div>
                <h2 className="role-section-subtitle">派生数值</h2>
                <div className="role-derived-grid">
                  {derivedCards.map(([label, value]) => (
                    <StatTile key={label} label={label} value={value} />
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'abilities' && (
              <section>
                <h2>能力树</h2>
                <div className="role-ability-grid">
                  {roleAbilityDefinitions.map((item) => (
                    <AbilityCard
                      key={item.key}
                      item={item}
                      current={abilityMap.get(item.key) || { level: 0, experience: 0 }}
                    />
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'records' && (
              <section>
                <h2>角色记录</h2>
                <div className="role-record-list">
                  <RecordGroup title="获得物品">
                    {role.items?.length ? role.items.map((item) => <Chip key={item}>{item}</Chip>) : <EmptyTag text="暂无物品记录" />}
                  </RecordGroup>
                  <RecordGroup title="经历世界">
                    {role.worlds?.length ? role.worlds.map((item) => <Chip key={item} tone="green">{item}</Chip>) : <EmptyTag text="暂无世界记录" />}
                  </RecordGroup>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
