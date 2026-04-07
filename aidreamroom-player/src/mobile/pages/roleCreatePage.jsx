import { useEffect, useMemo, useState } from 'react';
import { Input, InputNumber, Select, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import '../styles/index.scss';
import { images } from '../../constant';
import {
  MAX_ROLE_ATTRIBUTE_TOTAL,
  buildRolePayload,
  computeRoleAttributeMinTotal,
  computeRoleAttributeTotal,
  computeRoleDerivedStats,
  createRandomRoleAttributes,
  createDefaultRoleForm,
  genderOptions,
  hydrateRoleForm,
  roleAbilityDefinitions,
  roleAttributeDefinitions,
} from '../../constant/userRole';
import { API } from '../../utils/API';
import { ensureRoleProfile, getCachedRoleProfile, markRoleCreated } from '../../utils/session';

const { TextArea } = Input;
const defaultAttributeValue = 50;

const cardStyle = {
  width: '16.8rem',
  background: 'rgba(0, 0, 0, 0.28)',
  border: '0.044rem solid rgba(255,255,255,0.08)',
  borderRadius: '0.875rem',
  padding: '0.875rem',
  color: '#fff',
  boxSizing: 'border-box',
};

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.08)',
  borderColor: 'rgba(255,255,255,0.12)',
  color: '#fff',
};

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  const next = Number.isFinite(parsed) ? Math.round(parsed) : fallback;
  return Math.min(max, Math.max(min, next));
}

function ActionButton({ label, onClick, disabled = false }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        borderRadius: '999px',
        padding: '0.5rem 0.9rem',
        color: '#fff',
        background: 'rgba(28, 122, 59, 0.85)',
        border: '0.044rem solid rgba(255,255,255,0.12)',
        fontSize: '0.68rem',
        alignSelf: 'flex-end',
      }}
    >
      {label}
    </div>
  );
}

export function MobileRoleCreatePage() {
  const navigate = useNavigate();
  const cachedRoleResponse = getCachedRoleProfile();
  const [loading, setLoading] = useState(cachedRoleResponse === null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(createDefaultRoleForm());

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { role } = await ensureRoleProfile();
        if (!mounted) {
          return;
        }

        if (role) {
          message.info('角色已创建，不可修改');
          navigate('/mobile/mepage', { replace: true });
        } else {
          const nextForm = createDefaultRoleForm();
          setForm(nextForm);
        }
      } catch (error) {
        console.error(error);
        if (mounted) {
          message.error('角色数据加载失败');
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

  const derivedStats = useMemo(() => computeRoleDerivedStats(form), [form]);
  const attributeTotal = useMemo(() => computeRoleAttributeTotal(form), [form]);
  const remainingAttributePoints = useMemo(
    () => Math.max(0, MAX_ROLE_ATTRIBUTE_TOTAL - attributeTotal),
    [attributeTotal],
  );
  const minAttributeTotal = useMemo(() => computeRoleAttributeMinTotal(), []);

  const updateField = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const getAttributeRange = (key, source) => {
    const definition = roleAttributeDefinitions.find((item) => item.key === key);
    const currentValue = Number(source?.[key] ?? defaultAttributeValue);
    const otherTotal = computeRoleAttributeTotal(source) - currentValue;
    const min = definition?.recommendedMin ?? 1;
    const maxByRule = definition?.recommendedMax ?? 99;
    const maxByBudget = MAX_ROLE_ATTRIBUTE_TOTAL - otherTotal;

    return {
      min,
      max: Math.max(min, Math.min(maxByRule, maxByBudget)),
    };
  };

  const updateAttributeValue = (key, value) => {
    setForm((current) => {
      const range = getAttributeRange(key, current);
      return {
        ...current,
        [key]: clampNumber(value, range.min, range.max, current[key] ?? defaultAttributeValue),
      };
    });
  };

  const updateAbility = (index, key, value) => {
    setForm((current) => ({
      ...current,
      abilities: current.abilities.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        return {
          ...item,
          [key]: value,
        };
      }),
    }));
  };

  const randomizeAttributes = () => {
    setForm((current) => ({
      ...current,
      ...createRandomRoleAttributes(MAX_ROLE_ATTRIBUTE_TOTAL),
    }));
    message.success(`已随机生成九维属性，总值 ${MAX_ROLE_ATTRIBUTE_TOTAL}`);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      message.info('请输入角色姓名');
      return;
    }
    if (!form.appearanceStyle.trim()) {
      message.info('请填写外观样式');
      return;
    }
    if (attributeTotal > MAX_ROLE_ATTRIBUTE_TOTAL) {
      message.info(`九维总值不能超过 ${MAX_ROLE_ATTRIBUTE_TOTAL}`);
      return;
    }

    const payload = buildRolePayload(form, false);

    try {
      setSaving(true);
      const result = await API.USER_ROLE_CREATE(payload);

      if (result.result !== 0) {
        message.error(result.message || '角色保存失败');
        return;
      }

      markRoleCreated();
      message.success('角色创建成功');
      navigate('/mobile/mepage', { replace: true });
    } catch (error) {
      console.error(error);
      message.error('角色保存失败');
    } finally {
      setSaving(false);
    }
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

  const readonlyAbilities = true;

  return (
    <div className="mobile-app">
      <div className="main-container" style={{ background: `url(${images.background4})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
        <div className="mainpage-container">
          <div style={{ width: '100%', height: '100%', overflowY: 'auto', padding: '0.75rem 0.6rem 1.2rem', boxSizing: 'border-box' }}>
            <div className="normal-row" style={{ marginBottom: '0.75rem' }}>
              <div className="row">
                <img alt="back" src={images.icon_back} onClick={() => navigate('/mobile/main')} />
              </div>
              <span style={{ fontSize: '0.86rem' }}>创建角色</span>
              <ActionButton label={saving ? '保存中' : '创建'} onClick={submit} disabled={saving} />
            </div>

            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.58rem', textAlign: 'left', width: '16.8rem', lineHeight: 1.6, marginBottom: '0.75rem' }}>
              {`手机端同样支持中文九维车卡和总值限制。九维总值上限为 ${MAX_ROLE_ATTRIBUTE_TOTAL}，每项属性的可填写上限会随剩余额度动态变化。`}
            </div>

            <div style={cardStyle}>
              <div style={{ color: '#fff', fontSize: '0.76rem', textAlign: 'left', marginBottom: '0.7rem' }}>{'基础信息'}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.58rem', textAlign: 'left', marginBottom: '0.35rem' }}>{'姓名'}</div>
              <Input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="请输入角色姓名" style={{ ...inputStyle, marginBottom: '0.65rem' }} />

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.58rem', textAlign: 'left', marginBottom: '0.35rem' }}>{'性别'}</div>
                  <Select
                    className="role-gender-select"
                    popupClassName="role-gender-select-popup"
                    value={form.gender}
                    onChange={(value) => updateField('gender', value)}
                    options={genderOptions}
                    placeholder="请选择性别"
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.58rem', textAlign: 'left', marginBottom: '0.35rem' }}>{'年龄'}</div>
                  <InputNumber controls={false} min={1} max={120} value={form.age} onChange={(value) => updateField('age', value ?? 24)} style={inputStyle} />
                </div>
              </div>

              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.58rem', textAlign: 'left', marginBottom: '0.35rem' }}>{'外观样式'}</div>
              <TextArea value={form.appearanceStyle} onChange={(event) => updateField('appearanceStyle', event.target.value)} placeholder="简述外观、穿着、风格..." autoSize={{ minRows: 3, maxRows: 5 }} style={inputStyle} />
            </div>

            <div style={{ ...cardStyle, marginTop: '0.75rem' }}>
              <div style={{ color: '#fff', fontSize: '0.76rem', textAlign: 'left', marginBottom: '0.7rem' }}>{'九维总览'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {[
                  ['九维总值', `${attributeTotal} / ${MAX_ROLE_ATTRIBUTE_TOTAL}`],
                  ['剩余可分配', remainingAttributePoints],
                  ['规则最低总值', minAttributeTotal],
                  ['总值上限', MAX_ROLE_ATTRIBUTE_TOTAL],
                ].map(([label, value]) => (
                  <div key={label} style={{ width: '48%', padding: '0.55rem', borderRadius: '0.65rem', background: 'rgba(255,255,255,0.06)', marginBottom: '0.45rem' }}>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.52rem', textAlign: 'left' }}>{label}</div>
                    <div style={{ color: '#fff', fontSize: '0.7rem', textAlign: 'left', marginTop: '0.2rem' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...cardStyle, marginTop: '0.75rem' }}>
              <div style={{ color: '#fff', fontSize: '0.76rem', textAlign: 'left', marginBottom: '0.7rem' }}>{'派生数值'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {[
                  ['生命上限', derivedStats.maxHp],
                  ['魔法上限', derivedStats.maxMp],
                  ['负重', derivedStats.carryCapacity],
                  ['推举', derivedStats.pushLimit],
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
              <div className="normal-row" style={{ marginBottom: '0.7rem' }}>
                <div style={{ color: '#fff', fontSize: '0.76rem', textAlign: 'left' }}>{`九维属性 · ${attributeTotal} / ${MAX_ROLE_ATTRIBUTE_TOTAL}`}</div>
                <ActionButton label="随机生成" onClick={randomizeAttributes} />
              </div>
              {roleAttributeDefinitions.map((item) => {
                const currentLimit = getAttributeRange(item.key, form);
                return (
                  <div key={item.key} style={{ marginBottom: '0.7rem', paddingBottom: '0.7rem', borderBottom: '0.044rem solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ color: '#fff', fontSize: '0.72rem' }}>{item.label}</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.52rem' }}>{`${form[item.key]} / ${item.recommendedMax}`}</span>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.52rem', lineHeight: 1.6, textAlign: 'left', marginTop: '0.25rem' }}>{item.description}</div>
                    <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.52rem', textAlign: 'left', marginTop: '0.3rem' }}>{`可填范围 ${currentLimit.min} - ${currentLimit.max}`}</div>
                    <InputNumber controls={false} min={currentLimit.min} max={currentLimit.max} value={form[item.key]} onChange={(value) => updateAttributeValue(item.key, value)} style={{ ...inputStyle, marginTop: '0.45rem' }} />
                  </div>
                );
              })}
            </div>

            <div style={{ ...cardStyle, marginTop: '0.75rem' }}>
              <div style={{ color: '#fff', fontSize: '0.76rem', textAlign: 'left', marginBottom: '0.7rem' }}>{'能力树'}</div>
              {form.abilities.map((ability, index) => {
                const definition = roleAbilityDefinitions.find((item) => item.key === ability.abilityKey) || ability;
                return (
                  <div key={ability.abilityKey} style={{ marginBottom: '0.7rem', paddingBottom: '0.7rem', borderBottom: '0.044rem solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ color: '#fff', fontSize: '0.72rem' }}>{definition.label || ability.abilityName}</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.52rem' }}>{`等级 ${ability.level} / 10`}</span>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.52rem', lineHeight: 1.6, textAlign: 'left', marginTop: '0.25rem' }}>{definition.description}</div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.45rem' }}>
                      <InputNumber controls={false} min={0} max={10} disabled={readonlyAbilities} value={ability.level} onChange={(value) => updateAbility(index, 'level', value ?? 0)} style={inputStyle} />
                      <InputNumber controls={false} min={0} disabled={readonlyAbilities} value={ability.experience} onChange={(value) => updateAbility(index, 'experience', value ?? 0)} style={inputStyle} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ ...cardStyle, marginTop: '0.75rem' }}>
              <div style={{ color: '#fff', fontSize: '0.76rem', textAlign: 'left', marginBottom: '0.7rem' }}>{'成长记录'}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.58rem', textAlign: 'left', marginBottom: '0.35rem' }}>{'总经验'}</div>
              <InputNumber controls={false} min={0} value={form.experience} disabled={readonlyAbilities} onChange={(value) => updateField('experience', value ?? 0)} style={{ ...inputStyle, marginBottom: '0.65rem' }} />
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.58rem', textAlign: 'left', marginBottom: '0.35rem' }}>{'获得物品'}</div>
              <TextArea value={form.itemsText} disabled={readonlyAbilities} onChange={(event) => updateField('itemsText', event.target.value)} placeholder="每行一个物品" autoSize={{ minRows: 3, maxRows: 5 }} style={{ ...inputStyle, marginBottom: '0.65rem' }} />
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.58rem', textAlign: 'left', marginBottom: '0.35rem' }}>{'经历世界'}</div>
              <TextArea value={form.worldsText} disabled={readonlyAbilities} onChange={(event) => updateField('worldsText', event.target.value)} placeholder="每行一个世界" autoSize={{ minRows: 3, maxRows: 5 }} style={inputStyle} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
