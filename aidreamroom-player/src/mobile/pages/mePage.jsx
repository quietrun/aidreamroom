import { useEffect, useMemo, useState } from 'react';
import { Spin, message } from 'antd';
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
  ensureUserInfo,
  getCachedRoleProfile,
  getCachedUserDetail,
  getCachedUserInfo,
} from '../../utils/session';

const cardStyle = {
  width: '16.8rem',
  background: 'rgba(0, 0, 0, 0.28)',
  border: '0.044rem solid rgba(255,255,255,0.08)',
  borderRadius: '0.875rem',
  padding: '0.875rem',
  color: '#fff',
  boxSizing: 'border-box',
};

function ActionButton({ label, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderRadius: '999px',
        padding: '0.5rem 0.8rem',
        color: '#fff',
        background: 'rgba(28, 122, 59, 0.85)',
        border: '0.044rem solid rgba(255,255,255,0.12)',
        fontSize: '0.62rem',
      }}
    >
      {label}
    </div>
  );
}

export function MobileMePage() {
  const navigate = useNavigate();
  const cachedRoleResponse = getCachedRoleProfile();
  const cachedUserInfo = getCachedUserInfo();
  const cachedUserDetail = getCachedUserDetail();
  const [loading, setLoading] = useState(!(cachedRoleResponse && cachedUserInfo && cachedUserDetail));
  const [userInfo, setUserInfo] = useState(cachedUserInfo);
  const [detail, setDetail] = useState(cachedUserDetail);
  const [role, setRole] = useState(cachedRoleResponse?.role || null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [nextUserInfo, nextDetail, roleResponse] = await Promise.all([
          ensureUserInfo(),
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

        setUserInfo(nextUserInfo);
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
    plot: detail?.plot?.length || 0,
    character: detail?.character?.length || 0,
    elements: detail?.elements?.length || 0,
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
      <div className="main-container" style={{ background: `url(${images.background5})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
        <div className="mainpage-container">
          <div style={{ width: '100%', height: '100%', overflowY: 'auto', padding: '0.75rem 0.6rem 1.2rem', boxSizing: 'border-box' }}>
            <div className="normal-row" style={{ marginBottom: '0.75rem' }}>
              <div className="row">
                <img alt="back" src={images.icon_back} onClick={() => navigate('/mobile/main')} />
              </div>
              <span style={{ fontSize: '0.86rem' }}>{'我的角色'}</span>
              <div style={{ display: 'flex', gap: '0.22rem' }}>
                <ActionButton label="技能" onClick={() => navigate('/mobile/skills')} />
                <ActionButton label="物品" onClick={() => navigate('/mobile/items')} />
                <ActionButton label="仓库" onClick={() => navigate('/mobile/warehouse')} />
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img alt="avatar" src={images.avater} style={{ width: '2.8rem', height: '2.8rem', borderRadius: '2.8rem' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: '0.82rem', textAlign: 'left' }}>{role.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.56rem', textAlign: 'left', marginTop: '0.18rem' }}>{`${getDisplayGender(role.gender)} / ${role.age}岁`}</div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.56rem', textAlign: 'left', marginTop: '0.18rem' }}>{`总经验 ${role.experience}`}</div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.56rem', textAlign: 'left', marginTop: '0.18rem' }}>{`九维总值 ${attributeTotal}`}</div>
                </div>
              </div>
              <div style={{ marginTop: '0.7rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, fontSize: '0.56rem', textAlign: 'left' }}>
                {role.appearanceStyle || '暂未填写外观样式'}
              </div>
              <div style={{ marginTop: '0.7rem', paddingTop: '0.7rem', borderTop: '0.044rem solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.68)', fontSize: '0.56rem', lineHeight: 1.75, textAlign: 'left' }}>
                <div>{`用户名：${userInfo?.user_name || '--'}`}</div>
                <div>{`用户 ID：${userInfo?.user_id || '--'}`}</div>
                <div>{`邮箱：${userInfo?.user_email || '--'}`}</div>
              </div>
            </div>

            <div style={{ ...cardStyle, marginTop: '0.75rem' }}>
              <div style={{ color: '#fff', fontSize: '0.76rem', textAlign: 'left', marginBottom: '0.7rem' }}>{'派生数值'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {[
                  ['九维总值', attributeTotal],
                  ['生命上限', derivedStats.maxHp],
                  ['魔法上限', derivedStats.maxMp],
                  ['负重', derivedStats.carryCapacity],
                  ['伤害', derivedStats.damageBonus],
                  ['移速', derivedStats.moveRate],
                ].map(([label, value]) => (
                  <div key={label} style={{ width: '48%', padding: '0.55rem', borderRadius: '0.65rem', background: 'rgba(255,255,255,0.06)', marginBottom: '0.45rem' }}>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.52rem', textAlign: 'left' }}>{label}</div>
                    <div style={{ color: '#fff', fontSize: '0.7rem', textAlign: 'left', marginTop: '0.2rem' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...cardStyle, marginTop: '0.75rem' }}>
              <div style={{ color: '#fff', fontSize: '0.76rem', textAlign: 'left', marginBottom: '0.7rem' }}>{'冒险统计'}</div>
              <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.56rem', lineHeight: 1.8, textAlign: 'left' }}>
                <div>{`剧本：${counts.play}`}</div>
                <div>{`剧情：${counts.plot}`}</div>
                <div>{`角色素材：${counts.character}`}</div>
                <div>{`元素素材：${counts.elements}`}</div>
              </div>
            </div>

            <div style={{ ...cardStyle, marginTop: '0.75rem' }}>
              <div style={{ color: '#fff', fontSize: '0.76rem', textAlign: 'left', marginBottom: '0.7rem' }}>{`九维属性 · ${attributeTotal}`}</div>
              {roleAttributeDefinitions.map((item) => (
                <div key={item.key} style={{ marginBottom: '0.6rem', paddingBottom: '0.6rem', borderBottom: '0.044rem solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#fff', fontSize: '0.7rem' }}>{item.label}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.52rem' }}>{`${role.attributes?.[item.key] ?? 0}/99`}</span>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.52rem', lineHeight: 1.6, textAlign: 'left', marginTop: '0.2rem' }}>{item.description}</div>
                </div>
              ))}
            </div>

            <div style={{ ...cardStyle, marginTop: '0.75rem' }}>
              <div style={{ color: '#fff', fontSize: '0.76rem', textAlign: 'left', marginBottom: '0.7rem' }}>{'能力树'}</div>
              {roleAbilityDefinitions.map((item) => {
                const current = abilityMap.get(item.key) || { level: 0, experience: 0 };
                return (
                  <div key={item.key} style={{ marginBottom: '0.6rem', paddingBottom: '0.6rem', borderBottom: '0.044rem solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#fff', fontSize: '0.7rem' }}>{item.label}</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.52rem' }}>{`等级 ${current.level} / 10`}</span>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.52rem', lineHeight: 1.6, textAlign: 'left', marginTop: '0.2rem' }}>{item.description}</div>
                    <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.56rem', textAlign: 'left', marginTop: '0.3rem' }}>{`经验：${current.experience}`}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ ...cardStyle, marginTop: '0.75rem' }}>
              <div style={{ color: '#fff', fontSize: '0.76rem', textAlign: 'left', marginBottom: '0.7rem' }}>{'角色记录'}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.58rem', textAlign: 'left', marginBottom: '0.35rem' }}>{'获得物品'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {role.items?.length ? role.items.map((item) => (
                  <div key={item} style={{ padding: '0.3rem 0.55rem', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.52rem' }}>{item}</div>
                )) : <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.52rem' }}>{'暂无物品记录'}</div>}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.58rem', textAlign: 'left', marginBottom: '0.35rem', marginTop: '0.7rem' }}>{'经历世界'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {role.worlds?.length ? role.worlds.map((item) => (
                  <div key={item} style={{ padding: '0.3rem 0.55rem', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.52rem' }}>{item}</div>
                )) : <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.52rem' }}>{'暂无世界记录'}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
