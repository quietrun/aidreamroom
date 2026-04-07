import { useEffect, useMemo, useState } from 'react';
import { Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import '../styles/index.scss';
import { images } from '../constant';
import { formatSkillFormula, getSkillAbilityLabel, summarizeSkillList } from '../constant/skill';
import {
  ensureRoleProfile,
  ensureSkillList,
  getCachedRoleProfile,
  getCachedSkillList,
} from '../utils/session';

const panelStyle = {
  background: 'rgba(0, 0, 0, 0.28)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '1rem',
  padding: '1rem',
  color: '#fff',
};

function ActionButton({ label, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderRadius: '999px',
        padding: '0.65rem 1.2rem',
        color: '#fff',
        background: 'rgba(28, 122, 59, 0.85)',
        border: '1px solid rgba(255,255,255,0.12)',
        fontSize: '0.9rem',
      }}
    >
      {label}
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div style={{ padding: '0.85rem', borderRadius: '0.85rem', background: 'rgba(255,255,255,0.05)', marginBottom: '0.75rem' }}>
      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.76rem', textAlign: 'left' }}>{label}</div>
      <div style={{ color: '#fff', fontSize: '1.25rem', textAlign: 'left', marginTop: '0.35rem' }}>{value}</div>
    </div>
  );
}

function StatusTag({ available }) {
  return (
    <div
      style={{
        padding: '0.35rem 0.7rem',
        borderRadius: '999px',
        fontSize: '0.72rem',
        color: '#fff',
        background: available ? 'rgba(28,122,59,0.85)' : 'rgba(129, 75, 30, 0.85)',
      }}
    >
      {available ? '已达成要求' : '未达成要求'}
    </div>
  );
}

export function SkillPage() {
  const navigate = useNavigate();
  const cachedSkills = getCachedSkillList();
  const cachedRoleResponse = getCachedRoleProfile();
  const [loading, setLoading] = useState(!(cachedSkills && cachedRoleResponse));
  const [skills, setSkills] = useState(cachedSkills || []);
  const [role, setRole] = useState(cachedRoleResponse?.role || null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [nextSkills, roleResponse] = await Promise.all([
          ensureSkillList(),
          ensureRoleProfile(),
        ]);

        if (!mounted) {
          return;
        }

        if (!roleResponse.role) {
          navigate('/role/create', { replace: true });
          return;
        }

        setSkills(nextSkills);
        setRole(roleResponse.role);
      } catch (error) {
        console.error(error);
        if (mounted) {
          message.error('技能页面加载失败');
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

  const summary = useMemo(() => summarizeSkillList(skills), [skills]);

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

  return (
    <div className="main-container" style={{ background: `url(${images.background5})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
      <img alt="logo" className="login-logo" src={images.logo} />
      <div
        className="mainpage-container"
        style={{
          width: '78rem',
          height: '45rem',
          backgroundImage: 'none',
          backgroundColor: 'rgba(32, 35, 37, 0.94)',
          padding: '1.5rem 1.8rem',
        }}
      >
        <div className="normal-row" style={{ marginBottom: '1rem' }}>
          <div className="row">
            <img alt="back" src={images.icon_back} onClick={() => navigate('/mepage')} title="返回我的角色" />
            <span style={{ fontSize: '1.35rem' }}>{'技能库'}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.8rem' }}>
            <ActionButton label="返回角色页" onClick={() => navigate('/mepage')} />
          </div>
        </div>

        <div style={{ display: 'flex', width: '100%', flex: 1, gap: '1rem', overflow: 'hidden' }}>
          <div style={{ width: '20rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
            <div style={panelStyle}>
              <div style={{ color: '#fff', fontSize: '1rem', textAlign: 'left', marginBottom: '0.8rem' }}>{'角色技能概览'}</div>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.86rem', lineHeight: 1.7, textAlign: 'left', marginBottom: '0.9rem' }}>
                {role ? `${role.name} 的技能条件与预估伤害会根据当前九维与能力等级实时计算。` : '当前角色信息缺失。'}
              </div>
              <SummaryItem label="技能总数" value={summary.total} />
              <SummaryItem label="已达成要求" value={summary.availableCount} />
              <SummaryItem label="未达成要求" value={summary.unavailableCount} />
              <SummaryItem
                label="最高预估伤害"
                value={summary.highestDamageSkill ? `${summary.highestDamageSkill.name} · ${summary.highestDamageSkill.damagePreview ?? 0}` : '--'}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              {skills.map((skill) => (
                <div
                  key={skill.uuid}
                  style={{
                    ...panelStyle,
                    width: 'calc(50% - 0.5rem)',
                    minWidth: '24rem',
                    background: skill.available ? 'rgba(17, 67, 36, 0.34)' : 'rgba(65, 42, 18, 0.34)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem' }}>
                    <div>
                      <div style={{ color: '#fff', fontSize: '1.08rem', textAlign: 'left' }}>{skill.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: '0.74rem', textAlign: 'left', marginTop: '0.35rem' }}>
                        {`技能编号：${skill.uuid}`}
                      </div>
                    </div>
                    <StatusTag available={skill.available} />
                  </div>

                  <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem', lineHeight: 1.7, textAlign: 'left', marginTop: '0.8rem' }}>
                    {skill.description || '暂无技能描述'}
                  </div>

                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.8rem' }}>
                    <div style={{ flex: 1, padding: '0.85rem', borderRadius: '0.85rem', background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textAlign: 'left' }}>{'预估伤害'}</div>
                      <div style={{ color: '#fff', fontSize: '1.3rem', textAlign: 'left', marginTop: '0.35rem' }}>{skill.damagePreview ?? '--'}</div>
                    </div>
                    <div style={{ flex: 1, padding: '0.85rem', borderRadius: '0.85rem', background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textAlign: 'left' }}>{'伤害公式'}</div>
                      <div style={{ color: '#fff', fontSize: '0.8rem', lineHeight: 1.7, textAlign: 'left', marginTop: '0.35rem' }}>{formatSkillFormula(skill)}</div>
                    </div>
                  </div>

                  <div style={{ color: '#fff', fontSize: '0.86rem', textAlign: 'left', marginTop: '1rem', marginBottom: '0.7rem' }}>{'能力要求'}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                    {skill.requirements?.length ? skill.requirements.map((item) => (
                      <div
                        key={`${skill.uuid}-${item.abilityKey}`}
                        style={{
                          padding: '0.45rem 0.8rem',
                          borderRadius: '999px',
                          background: item.met ? 'rgba(28,122,59,0.18)' : 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          fontSize: '0.76rem',
                        }}
                      >
                        {`${getSkillAbilityLabel(item.abilityKey, item.abilityName)} ${item.currentLevel}/${item.requiredLevel}`}
                      </div>
                    )) : (
                      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem' }}>{'无门槛要求'}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <img alt="eng-logo" className="login-eng-logo" src={images.eng_logo} />
    </div>
  );
}
