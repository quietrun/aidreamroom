import { useEffect, useMemo, useState } from 'react';
import { Input, InputNumber, Select, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import '../styles/index.scss';
import { images } from '../constant';
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
} from '../constant/userRole';
import { API } from '../utils/API';
import { ensureRoleProfile, getCachedRoleProfile, markRoleCreated } from '../utils/session';

const { TextArea } = Input;
const defaultAttributeValue = 50;

const cardStyle = {
  background: 'rgba(0, 0, 0, 0.28)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '1rem',
  padding: '1rem',
  color: '#fff',
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

function SectionTitle({ title, extra }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
      <span style={{ fontSize: '1.05rem', color: '#fff' }}>{title}</span>
      {extra}
    </div>
  );
}

function ActionButton({ label, onClick, disabled = false }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
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

function renderDerivedItem(label, value) {
  return (
    <div key={label} style={{ width: '48%', padding: '0.75rem', borderRadius: '0.8rem', background: 'rgba(255,255,255,0.06)', marginBottom: '0.6rem' }}>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', textAlign: 'left' }}>{label}</div>
      <div style={{ color: '#fff', fontSize: '1rem', textAlign: 'left', marginTop: '0.3rem' }}>{value}</div>
    </div>
  );
}

function InlineActionButton({ label, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderRadius: '999px',
        padding: '0.38rem 0.85rem',
        color: '#fff',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        fontSize: '0.76rem',
        lineHeight: 1,
      }}
    >
      {label}
    </div>
  );
}

export function RoleCreatePage() {
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
          navigate('/mepage', { replace: true });
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
      navigate('/mepage', { replace: true });
    } catch (error) {
      console.error(error);
      message.error('角色保存失败');
    } finally {
      setSaving(false);
    }
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

  const readonlyAbilities = true;

  return (
    <div className="main-container" style={{ background: `url(${images.background4})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
      <img alt="logo" className="login-logo" src={images.logo} />
      <div
        className="mainpage-container"
        style={{
          width: '78rem',
          height: '45rem',
          backgroundImage: 'none',
          backgroundColor: 'rgba(44, 41, 38, 0.92)',
          padding: '1.5rem 1.8rem',
        }}
      >
        <div className="normal-row" style={{ marginBottom: '1rem' }}>
          <div className="row" style={{ alignItems: 'center' }}>
            <img alt="back" src={images.icon_back} onClick={() => navigate('/main')} title="返回" />
            <span style={{ fontSize: '1.35rem' }}>创建角色</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <ActionButton label={saving ? '保存中...' : '创建角色'} onClick={submit} disabled={saving} />
          </div>
        </div>

        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', width: '100%', textAlign: 'left', marginBottom: '1rem', lineHeight: 1.7 }}>
          {`本页使用 CoC 风格九维车卡逻辑。九维总值上限为 ${MAX_ROLE_ATTRIBUTE_TOTAL}，调整单项属性时会根据剩余额度动态限制可填写范围。`}
        </div>

        <div style={{ display: 'flex', flex: 1, width: '100%', gap: '1rem', overflow: 'hidden' }}>
          <div style={{ width: '22rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
            <div style={cardStyle}>
              <SectionTitle title="基础信息" />
              <div style={{ marginBottom: '0.8rem', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>{'姓名'}</div>
              <Input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="请输入角色姓名" style={{ ...inputStyle, marginBottom: '0.9rem' }} />

              <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '0.9rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: '0.5rem', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>{'性别'}</div>
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
                  <div style={{ marginBottom: '0.5rem', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>{'年龄'}</div>
                  <InputNumber controls={false} min={1} max={120} value={form.age} onChange={(value) => updateField('age', value ?? 24)} style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: '0.5rem', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>{'外观样式'}</div>
              <TextArea
                value={form.appearanceStyle}
                onChange={(event) => updateField('appearanceStyle', event.target.value)}
                placeholder="例如发型、穿着、具有识别度的细节..."
                autoSize={{ minRows: 4, maxRows: 6 }}
                style={{ ...inputStyle, marginBottom: '0.2rem' }}
              />
            </div>

            <div style={{ ...cardStyle, marginTop: '1rem' }}>
              <SectionTitle title="九维总览" />
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                {renderDerivedItem('九维总值', `${attributeTotal} / ${MAX_ROLE_ATTRIBUTE_TOTAL}`)}
                {renderDerivedItem('剩余可分配', remainingAttributePoints)}
                {renderDerivedItem('规则最低总值', minAttributeTotal)}
                {renderDerivedItem('总值上限', MAX_ROLE_ATTRIBUTE_TOTAL)}
              </div>
            </div>

            <div style={{ ...cardStyle, marginTop: '1rem' }}>
              <SectionTitle title="派生数值" />
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                {renderDerivedItem('生命上限', derivedStats.maxHp)}
                {renderDerivedItem('魔法上限', derivedStats.maxMp)}
                {renderDerivedItem('负重', derivedStats.carryCapacity)}
                {renderDerivedItem('推举极限', derivedStats.pushLimit)}
                {renderDerivedItem('伤害加值', derivedStats.damageBonus)}
                {renderDerivedItem('体格', derivedStats.build)}
                {renderDerivedItem('移动速率', derivedStats.moveRate)}
                {renderDerivedItem('射击加成', `+${derivedStats.shootBonus}`)}
                {renderDerivedItem('社交加成', `+${derivedStats.socialBonus}`)}
                {renderDerivedItem('精神抗性', derivedStats.spellResistance)}
                {renderDerivedItem('学习加成', `+${derivedStats.learningBonus}`)}
                {renderDerivedItem('幸运加成', `+${derivedStats.critBonus}`)}
              </div>
            </div>

            <div style={{ ...cardStyle, marginTop: '1rem' }}>
              <SectionTitle title="成长记录" extra={<span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem' }}>创建后锁定</span>} />
              <div style={{ marginBottom: '0.5rem', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>{'总经验'}</div>
              <InputNumber controls={false} min={0} value={form.experience} disabled={readonlyAbilities} onChange={(value) => updateField('experience', value ?? 0)} style={{ ...inputStyle, marginBottom: '0.9rem' }} />

              <div style={{ marginBottom: '0.5rem', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>{'获得物品'}</div>
              <TextArea value={form.itemsText} disabled={readonlyAbilities} onChange={(event) => updateField('itemsText', event.target.value)} placeholder="每行一个物品" autoSize={{ minRows: 4, maxRows: 6 }} style={{ ...inputStyle, marginBottom: '0.9rem' }} />

              <div style={{ marginBottom: '0.5rem', textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>{'经历世界'}</div>
              <TextArea value={form.worldsText} disabled={readonlyAbilities} onChange={(event) => updateField('worldsText', event.target.value)} placeholder="每行一个世界" autoSize={{ minRows: 4, maxRows: 6 }} style={inputStyle} />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
            <div style={cardStyle}>
              <SectionTitle
                title="九维属性"
                extra={(
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem' }}>{`总值 ${attributeTotal} / ${MAX_ROLE_ATTRIBUTE_TOTAL}`}</span>
                    <InlineActionButton label="随机生成" onClick={randomizeAttributes} />
                  </div>
                )}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
                {roleAttributeDefinitions.map((item) => {
                  const currentLimit = getAttributeRange(item.key, form);
                  return (
                    <div key={item.key} style={{ width: 'calc(33.33% - 0.54rem)', minWidth: '12rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.05)', padding: '0.9rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '1rem', color: '#fff' }}>{item.label}</span>
                        <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)' }}>{`${form[item.key]} / ${item.recommendedMax}`}</span>
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem', textAlign: 'left', marginTop: '0.35rem' }}>{`推荐 ${item.recommendedRange}`}</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.68rem', textAlign: 'left', marginTop: '0.2rem' }}>{item.diceRule}</div>
                      <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem', textAlign: 'left', marginTop: '0.7rem' }}>{`当前可填范围 ${currentLimit.min} - ${currentLimit.max}`}</div>
                      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.68rem', textAlign: 'left', marginTop: '0.65rem', marginBottom: '0.25rem' }}>{'填写数值'}</div>
                      <InputNumber controls={false} min={currentLimit.min} max={currentLimit.max} value={form[item.key]} onChange={(value) => updateAttributeValue(item.key, value)} style={inputStyle} />
                      <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.78rem', lineHeight: 1.6, textAlign: 'left', marginTop: '0.7rem' }}>{item.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...cardStyle, marginTop: '1rem' }}>
              <SectionTitle title="能力树" extra={<span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem' }}>{'等级 0 - 10，经验独立累计'}</span>} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
                {form.abilities.map((ability, index) => {
                  const definition = roleAbilityDefinitions.find((item) => item.key === ability.abilityKey) || ability;
                  return (
                    <div key={ability.abilityKey} style={{ width: 'calc(50% - 0.4rem)', minWidth: '18rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.05)', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '1rem', color: '#fff' }}>{definition.label || ability.abilityName}</span>
                        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>{`等级 ${ability.level} / 10`}</span>
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.78rem', lineHeight: 1.6, textAlign: 'left', marginTop: '0.5rem', minHeight: '2.4rem' }}>{definition.description}</div>
                      <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.8rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ marginBottom: '0.4rem', textAlign: 'left', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>{'等级'}</div>
                          <InputNumber controls={false} min={0} max={10} disabled={readonlyAbilities} value={ability.level} onChange={(value) => updateAbility(index, 'level', value ?? 0)} style={inputStyle} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ marginBottom: '0.4rem', textAlign: 'left', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>{'经验'}</div>
                          <InputNumber controls={false} min={0} disabled={readonlyAbilities} value={ability.experience} onChange={(value) => updateAbility(index, 'experience', value ?? 0)} style={inputStyle} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <img alt="eng-logo" className="login-eng-logo" src={images.eng_logo} />
    </div>
  );
}
