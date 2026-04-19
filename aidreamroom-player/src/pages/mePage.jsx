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

const panelStyle = {
  background: 'rgba(0, 0, 0, 0.28)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '1rem',
  padding: '1rem',
  color: '#fff',
};

function ActionButton({ label, onClick, danger = false }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderRadius: '999px',
        padding: '0.65rem 1.2rem',
        color: '#fff',
        background: danger ? 'rgba(142, 38, 32, 0.86)' : 'rgba(28, 122, 59, 0.85)',
        border: '1px solid rgba(255,255,255,0.12)',
        fontSize: '0.9rem',
      }}
    >
      {label}
    </div>
  );
}

function EmptyTag({ text }) {
  return (
    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', textAlign: 'left' }}>
      {text}
    </div>
  );
}

function renderStat(label, value) {
  return (
    <div key={label} style={{ width: '48%', padding: '0.75rem', borderRadius: '0.8rem', background: 'rgba(255,255,255,0.06)', marginBottom: '0.6rem' }}>
      <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.72rem', textAlign: 'left' }}>{label}</div>
      <div style={{ color: '#fff', fontSize: '1rem', textAlign: 'left', marginTop: '0.3rem' }}>{value}</div>
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
    <div className="main-container" style={{ background: `url(${images.background5})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
      <img alt="logo" className="login-logo" src={images.logo} />
      <div
        className="mainpage-container"
        style={{
          width: '78rem',
          height: '45rem',
          backgroundImage: 'none',
          backgroundColor: 'rgba(35, 38, 40, 0.92)',
          padding: '1.5rem 1.8rem',
        }}
      >
        <div className="normal-row" style={{ marginBottom: '1rem' }}>
          <div className="row">
            <img alt="back" src={images.icon_back} onClick={() => navigate('/main')} title="返回主页" />
            <span style={{ fontSize: '1.35rem' }}>{'我的角色'}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.8rem' }}>
            <ActionButton label="技能库" onClick={() => navigate('/skills')} />
            <ActionButton label="物品库" onClick={() => navigate('/items')} />
            <ActionButton label="仓库" onClick={() => navigate('/warehouse')} />
            <ActionButton label="重新生成角色" onClick={resetRole} danger />
            <ActionButton label="返回主页" onClick={() => navigate('/main')} />
          </div>
        </div>

        <div style={{ display: 'flex', width: '100%', flex: 1, gap: '1rem', overflow: 'hidden' }}>
          <div style={{ width: '22rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
            <div style={panelStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <img alt="avatar" src={images.avater} style={{ width: '4.5rem', height: '4.5rem', borderRadius: '4.5rem' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: '1.2rem', textAlign: 'left' }}>{role.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', textAlign: 'left', marginTop: '0.3rem' }}>
                    {`${getDisplayGender(role.gender)} / ${role.age}岁`}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', textAlign: 'left', marginTop: '0.2rem' }}>
                    {`总经验 ${role.experience}`}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', textAlign: 'left', marginTop: '0.2rem' }}>
                    {`九维总值 ${attributeTotal}`}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.7, fontSize: '0.82rem', textAlign: 'left' }}>
                {role.appearanceStyle || '暂未填写外观样式'}
              </div>
            </div>

            <div style={{ ...panelStyle, marginTop: '1rem' }}>
              <div style={{ color: '#fff', fontSize: '0.95rem', textAlign: 'left', marginBottom: '0.8rem' }}>{'派生数值'}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                {renderStat('九维总值', attributeTotal)}
                {renderStat('生命上限', derivedStats.maxHp)}
                {renderStat('魔法上限', derivedStats.maxMp)}
                {renderStat('负重', derivedStats.carryCapacity)}
                {renderStat('推举极限', derivedStats.pushLimit)}
                {renderStat('伤害加值', derivedStats.damageBonus)}
                {renderStat('移动速率', derivedStats.moveRate)}
                {renderStat('射击加成', `+${derivedStats.shootBonus}`)}
                {renderStat('社交加成', `+${derivedStats.socialBonus}`)}
                {renderStat('学习加成', `+${derivedStats.learningBonus}`)}
                {renderStat('幸运加成', `+${derivedStats.critBonus}`)}
              </div>
            </div>

            <div style={{ ...panelStyle, marginTop: '1rem' }}>
              <div style={{ color: '#fff', fontSize: '0.95rem', textAlign: 'left', marginBottom: '0.8rem' }}>{'冒险统计'}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                {renderStat('剧本', counts.play)}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
            <div style={panelStyle}>
              <div style={{ color: '#fff', fontSize: '1rem', textAlign: 'left', marginBottom: '0.9rem' }}>{`九维属性 · ${attributeTotal}`}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
                {roleAttributeDefinitions.map((item) => (
                  <div key={item.key} style={{ width: 'calc(33.33% - 0.54rem)', minWidth: '12rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.05)', padding: '0.9rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ color: '#fff', fontSize: '1rem' }}>{item.label}</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>{'/99'}</span>
                    </div>
                    <div style={{ color: '#fff', fontSize: '1.5rem', textAlign: 'left', marginTop: '0.65rem' }}>{role.attributes?.[item.key] ?? 0}</div>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.74rem', lineHeight: 1.65, textAlign: 'left', marginTop: '0.55rem' }}>{item.description}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...panelStyle, marginTop: '1rem' }}>
              <div style={{ color: '#fff', fontSize: '1rem', textAlign: 'left', marginBottom: '0.9rem' }}>{'能力树'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
                {roleAbilityDefinitions.map((item) => {
                  const current = abilityMap.get(item.key) || { level: 0, experience: 0 };
                  return (
                    <div key={item.key} style={{ width: 'calc(50% - 0.4rem)', minWidth: '18rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.05)', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#fff', fontSize: '1rem' }}>{item.label}</span>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>{`等级 ${current.level} / 10`}</span>
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.78rem', lineHeight: 1.6, textAlign: 'left', marginTop: '0.5rem' }}>{item.description}</div>
                      <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ width: '48%', padding: '0.75rem', borderRadius: '0.8rem', background: 'rgba(255,255,255,0.04)' }}>
                          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textAlign: 'left' }}>{'等级'}</div>
                          <div style={{ color: '#fff', fontSize: '1rem', textAlign: 'left', marginTop: '0.3rem' }}>{current.level}</div>
                        </div>
                        <div style={{ width: '48%', padding: '0.75rem', borderRadius: '0.8rem', background: 'rgba(255,255,255,0.04)' }}>
                          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textAlign: 'left' }}>{'经验'}</div>
                          <div style={{ color: '#fff', fontSize: '1rem', textAlign: 'left', marginTop: '0.3rem' }}>{current.experience}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...panelStyle, marginTop: '1rem' }}>
              <div style={{ color: '#fff', fontSize: '1rem', textAlign: 'left', marginBottom: '0.9rem' }}>{'角色记录'}</div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.86rem', textAlign: 'left', marginBottom: '0.7rem' }}>{'获得物品'}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {role.items?.length ? role.items.map((item) => (
                      <div key={item} style={{ padding: '0.45rem 0.8rem', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.78rem' }}>
                        {item}
                      </div>
                    )) : <EmptyTag text="暂无物品记录" />}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.86rem', textAlign: 'left', marginBottom: '0.7rem' }}>{'经历世界'}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {role.worlds?.length ? role.worlds.map((item) => (
                      <div key={item} style={{ padding: '0.45rem 0.8rem', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.78rem' }}>
                        {item}
                      </div>
                    )) : <EmptyTag text="暂无世界记录" />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <img alt="eng-logo" className="login-eng-logo" src={images.eng_logo} />
    </div>
  );
}
