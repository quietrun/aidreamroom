import { useEffect, useMemo, useState } from 'react';
import { Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import '../styles/index.scss';
import { images } from '../../constant';
import { formatSkillFormula, getSkillAbilityLabel, summarizeSkillList } from '../../constant/skill';
import {
  ensureRoleProfile,
  ensureSkillList,
  getCachedRoleProfile,
  getCachedSkillList,
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
        padding: '0.45rem 0.7rem',
        color: '#fff',
        background: 'rgba(28, 122, 59, 0.85)',
        border: '0.044rem solid rgba(255,255,255,0.12)',
        fontSize: '0.58rem',
      }}
    >
      {label}
    </div>
  );
}

function StatusTag({ available }) {
  return (
    <div
      style={{
        padding: '0.22rem 0.45rem',
        borderRadius: '999px',
        fontSize: '0.48rem',
        color: '#fff',
        background: available ? 'rgba(28,122,59,0.85)' : 'rgba(129, 75, 30, 0.85)',
      }}
    >
      {available ? '可用' : '未达成'}
    </div>
  );
}

export function MobileSkillPage() {
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
          navigate('/mobile/role/create', { replace: true });
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
      <div className="mobile-app">
        <div className="main-container">
          <div className="mainpage-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <Spin />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-app">
      <div className="main-container" style={{ background: `url(${images.background5})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
        <div className="mainpage-container">
          <div style={{ width: '100%', height: '100%', overflowY: 'auto', padding: '0.75rem 0.6rem 1.2rem', boxSizing: 'border-box' }}>
            <div className="normal-row" style={{ marginBottom: '0.75rem' }}>
              <div className="row">
                <img alt="back" src={images.icon_back} onClick={() => navigate('/mobile/mepage')} />
              </div>
              <span style={{ fontSize: '0.86rem' }}>{'技能库'}</span>
              <ActionButton label="返回" onClick={() => navigate('/mobile/mepage')} />
            </div>

            <div style={cardStyle}>
              <div style={{ color: '#fff', fontSize: '0.76rem', textAlign: 'left', marginBottom: '0.5rem' }}>{'技能概览'}</div>
              <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.56rem', lineHeight: 1.7, textAlign: 'left', marginBottom: '0.65rem' }}>
                {role ? `${role.name} 当前可查看技能门槛与预估伤害。` : '当前角色信息缺失。'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {[
                  ['总技能数', summary.total],
                  ['可用技能', summary.availableCount],
                  ['未达成', summary.unavailableCount],
                  ['最高伤害', summary.highestDamageSkill ? summary.highestDamageSkill.damagePreview ?? 0 : '--'],
                ].map(([label, value]) => (
                  <div key={label} style={{ width: '48%', padding: '0.55rem', borderRadius: '0.65rem', background: 'rgba(255,255,255,0.06)', marginBottom: '0.45rem' }}>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.52rem', textAlign: 'left' }}>{label}</div>
                    <div style={{ color: '#fff', fontSize: '0.7rem', textAlign: 'left', marginTop: '0.2rem' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {skills.map((skill) => (
              <div
                key={skill.uuid}
                style={{
                  ...cardStyle,
                  marginTop: '0.75rem',
                  background: skill.available ? 'rgba(17, 67, 36, 0.34)' : 'rgba(65, 42, 18, 0.34)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.45rem' }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: '0.72rem', textAlign: 'left' }}>{skill.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.48rem', textAlign: 'left', marginTop: '0.15rem' }}>{skill.uuid}</div>
                  </div>
                  <StatusTag available={skill.available} />
                </div>

                <div style={{ color: 'rgba(255,255,255,0.74)', fontSize: '0.54rem', lineHeight: 1.65, textAlign: 'left', marginTop: '0.45rem' }}>
                  {skill.description || '暂无技能描述'}
                </div>

                <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.55rem' }}>
                  <div style={{ flex: 1, padding: '0.5rem', borderRadius: '0.65rem', background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.48rem', textAlign: 'left' }}>{'预估伤害'}</div>
                    <div style={{ color: '#fff', fontSize: '0.76rem', textAlign: 'left', marginTop: '0.15rem' }}>{skill.damagePreview ?? '--'}</div>
                  </div>
                  <div style={{ flex: 1, padding: '0.5rem', borderRadius: '0.65rem', background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.48rem', textAlign: 'left' }}>{'伤害公式'}</div>
                    <div style={{ color: '#fff', fontSize: '0.5rem', lineHeight: 1.55, textAlign: 'left', marginTop: '0.15rem' }}>{formatSkillFormula(skill)}</div>
                  </div>
                </div>

                <div style={{ color: '#fff', fontSize: '0.6rem', textAlign: 'left', marginTop: '0.55rem', marginBottom: '0.35rem' }}>{'能力要求'}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.28rem' }}>
                  {skill.requirements?.length ? skill.requirements.map((item) => (
                    <div
                      key={`${skill.uuid}-${item.abilityKey}`}
                      style={{
                        padding: '0.24rem 0.45rem',
                        borderRadius: '999px',
                        background: item.met ? 'rgba(28,122,59,0.18)' : 'rgba(255,255,255,0.08)',
                        color: '#fff',
                        fontSize: '0.48rem',
                      }}
                    >
                      {`${getSkillAbilityLabel(item.abilityKey, item.abilityName)} ${item.currentLevel}/${item.requiredLevel}`}
                    </div>
                  )) : <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.5rem' }}>{'无门槛要求'}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
