import { useEffect, useMemo, useState } from 'react';
import { Modal, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import '../styles/index.scss';
import { images } from '../../constant';
import {
  computeRoleAttributeTotal,
  computeRoleDerivedStats,
  getDisplayGender,
  roleAbilityDefinitions,
  roleAttributeDefinitions,
} from '../../constant/userRole';
import {
  ensureRoleProfile,
  ensureUserDetail,
  getCachedRoleProfile,
  getCachedUserDetail,
  markRoleReset,
} from '../../utils/session';
import { API } from '../../utils/API';

const mobileRoleTabs = [
  { key: 'attributes', label: '属性' },
  { key: 'derived', label: '派生' },
  { key: 'abilities', label: '能力' },
  { key: 'records', label: '记录' },
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
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderRadius: '999px',
        padding: '0.28rem 0.48rem',
        color: '#fff',
        background: danger ? 'rgba(142, 38, 32, 0.86)' : 'rgba(28, 122, 59, 0.85)',
        border: '0.044rem solid rgba(255,255,255,0.12)',
        fontSize: '0.5rem',
      }}
    >
      {label}
    </div>
  );
}

function MobileStatPill({ label, value }) {
  return (
    <span className="mobile-role-stat-pill">
      <em>{label}</em>
      <strong>{value}</strong>
    </span>
  );
}

function MobileAttributeList({ role }) {
  return (
    <div className="mobile-role-attribute-list">
      {roleAttributeDefinitions.map((item, index) => {
        const value = Number(role.attributes?.[item.key] ?? 0);
        const percent = Math.min(100, Math.max(0, (value / 99) * 100));

        return (
          <div key={item.key} className="mobile-role-attribute-card">
            <div>
              <span>{item.label}</span>
              <strong>{value}<em>/99</em></strong>
            </div>
            <i>
              <b style={{ width: `${percent}%`, background: attributeColors[index % attributeColors.length] }} />
            </i>
          </div>
        );
      })}
    </div>
  );
}

function MobileDerivedGrid({ derivedStats, attributeTotal }) {
  return (
    <div className="mobile-role-derived-grid">
      {[
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
        ['九维总值', attributeTotal],
      ].map(([label, value]) => (
        <div key={label} className="mobile-role-derived-card">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function MobileAbilityList({ abilityMap }) {
  return (
    <div className="mobile-role-info-list">
      {roleAbilityDefinitions.map((item) => {
        const current = abilityMap.get(item.key) || { level: 0, experience: 0 };
        return (
          <div key={item.key} className="mobile-role-info-card">
            <div>
              <strong>{item.label}</strong>
              <span>{`等级 ${current.level} / 10 · 经验 ${current.experience}`}</span>
            </div>
            <p>{item.description}</p>
          </div>
        );
      })}
    </div>
  );
}

function MobileRecordList({ role, counts }) {
  return (
    <div className="mobile-role-info-list">
      <div className="mobile-role-info-card">
        <div>
          <strong>冒险统计</strong>
          <span>{`剧本 ${counts.play}`}</span>
        </div>
      </div>
      <div className="mobile-role-info-card">
        <div>
          <strong>获得物品</strong>
          <span>{role.items?.length ? `${role.items.length} 项` : '暂无记录'}</span>
        </div>
        <div className="mobile-role-chip-list">
          {role.items?.length ? role.items.map((item) => <em key={item}>{item}</em>) : null}
        </div>
      </div>
      <div className="mobile-role-info-card">
        <div>
          <strong>经历世界</strong>
          <span>{role.worlds?.length ? `${role.worlds.length} 个` : '暂无记录'}</span>
        </div>
        <div className="mobile-role-chip-list">
          {role.worlds?.length ? role.worlds.map((item) => <em key={item}>{item}</em>) : null}
        </div>
      </div>
    </div>
  );
}

export function MobileMePage() {
  const navigate = useNavigate();
  const cachedRoleResponse = getCachedRoleProfile();
  const cachedUserDetail = getCachedUserDetail();
  const [loading, setLoading] = useState(!(cachedRoleResponse && cachedUserDetail));
  const [detail, setDetail] = useState(cachedUserDetail);
  const [role, setRole] = useState(cachedRoleResponse?.role || null);
  const [activeTab, setActiveTab] = useState('attributes');

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
          navigate('/mobile/role/create', { replace: true });
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
  };

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
        navigate('/mobile/role/create', { replace: true });
        return undefined;
      },
    });
  };

  if (loading) {
    return (
      <div className="mobile-app">
        <div className="main-container">
          <div className="mainpage-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
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
      <div className="main-container mobile-role-page" style={{ background: `url(${images.background5})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
        <div className="mobile-role-shell">
          <header className="mobile-role-header">
            <button className="mobile-round-icon" type="button" onClick={() => navigate('/mobile/main')}>
              <img alt="back" src={images.icon_back} />
            </button>
            <strong>我的角色</strong>
            <div className="mobile-role-actions">
              <ActionButton label="技能" onClick={() => navigate('/mobile/skills')} />
              <ActionButton label="物品" onClick={() => navigate('/mobile/items')} />
              <ActionButton label="仓库" onClick={() => navigate('/mobile/warehouse')} />
            </div>
          </header>

          <section className="mobile-role-profile">
            <img alt="avatar" src={images.avater} />
            <div>
              <h1>{role.name}</h1>
              <p>{`${getDisplayGender(role.gender)} · ${role.age}岁 · 经验 ${role.experience}`}</p>
              <div>
                <MobileStatPill label="HP" value={derivedStats.maxHp} />
                <MobileStatPill label="MP" value={derivedStats.maxMp} />
                <MobileStatPill label="九维" value={attributeTotal} />
              </div>
            </div>
          </section>

          <p className="mobile-role-intro">{role.appearanceStyle || '暂未填写外观样式'}</p>

          <nav className="mobile-role-tabs">
            {mobileRoleTabs.map((tab) => (
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

          <main className="mobile-role-content">
            {activeTab === 'attributes' ? <MobileAttributeList role={role} /> : null}
            {activeTab === 'derived' ? <MobileDerivedGrid derivedStats={derivedStats} attributeTotal={attributeTotal} /> : null}
            {activeTab === 'abilities' ? <MobileAbilityList abilityMap={abilityMap} /> : null}
            {activeTab === 'records' ? <MobileRecordList role={role} counts={counts} /> : null}
            {activeTab === 'records' ? (
              <button className="mobile-role-reset" type="button" onClick={resetRole}>重生</button>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
