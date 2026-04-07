import { useEffect, useMemo, useState } from 'react';
import { Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import '../styles/index.scss';
import { images } from '../constant';
import {
  formatConsumableEffectLabel,
  formatItemFormula,
  formatModifierLabel,
  getEquipmentSlotLabel,
  getItemTypeLabel,
  summarizeItemCatalog,
} from '../constant/item';
import {
  ensureItemList,
  ensureRoleProfile,
  getCachedItemList,
  getCachedRoleProfile,
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

function ItemTag({ label, accent = 'rgba(255,255,255,0.12)' }) {
  return (
    <div style={{ padding: '0.35rem 0.7rem', borderRadius: '999px', background: accent, color: '#fff', fontSize: '0.72rem' }}>
      {label}
    </div>
  );
}

function ModifierList({ title, items, formatter = formatModifierLabel, emptyText = '暂无加成' }) {
  return (
    <div style={{ marginTop: '0.9rem' }}>
      <div style={{ color: '#fff', fontSize: '0.86rem', textAlign: 'left', marginBottom: '0.55rem' }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {items?.length ? items.map((item, index) => (
          <div key={`${title}-${index}`} style={{ padding: '0.4rem 0.75rem', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.76rem' }}>
            {formatter(item)}
          </div>
        )) : <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.76rem' }}>{emptyText}</div>}
      </div>
    </div>
  );
}

export function ItemPage() {
  const navigate = useNavigate();
  const cachedItems = getCachedItemList();
  const cachedRoleResponse = getCachedRoleProfile();
  const [loading, setLoading] = useState(!(cachedItems && cachedRoleResponse));
  const [items, setItems] = useState(cachedItems || []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [nextItems, roleResponse] = await Promise.all([
          ensureItemList(),
          ensureRoleProfile(),
        ]);

        if (!mounted) {
          return;
        }

        if (!roleResponse.role) {
          navigate('/role/create', { replace: true });
          return;
        }

        setItems(nextItems);
      } catch (error) {
        console.error(error);
        if (mounted) {
          message.error('物品库加载失败');
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

  const summary = useMemo(() => summarizeItemCatalog(items), [items]);

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
            <span style={{ fontSize: '1.35rem' }}>{'物品库'}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.8rem' }}>
            <ActionButton label="查看仓库" onClick={() => navigate('/warehouse')} />
            <ActionButton label="返回角色" onClick={() => navigate('/mepage')} />
          </div>
        </div>

        <div style={{ display: 'flex', width: '100%', flex: 1, gap: '1rem', overflow: 'hidden' }}>
          <div style={{ width: '20rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
            <div style={panelStyle}>
              <div style={{ color: '#fff', fontSize: '1rem', textAlign: 'left', marginBottom: '0.8rem' }}>{'物品概览'}</div>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.86rem', lineHeight: 1.7, textAlign: 'left', marginBottom: '0.9rem' }}>
                物品分为消耗品、武器、装备三类。武器支持附赠伤害公式，装备支持基础属性与词条加成，技能卡则在仓库中单独保管。
              </div>
              <SummaryItem label="总物品数" value={summary.total} />
              <SummaryItem label="消耗品" value={summary.consumables} />
              <SummaryItem label="武器" value={summary.weapons} />
              <SummaryItem label="装备" value={summary.equipments} />
              <SummaryItem
                label="最高预估武器伤害"
                value={summary.highestDamageWeapon ? `${summary.highestDamageWeapon.name} · ${summary.highestDamageWeapon.damagePreview ?? '--'}` : '--'}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              {items.map((item) => {
                const accent = item.itemType === 'weapon'
                  ? 'rgba(140, 59, 32, 0.28)'
                  : item.itemType === 'equipment'
                    ? 'rgba(25, 73, 51, 0.28)'
                    : 'rgba(53, 65, 92, 0.28)';

                return (
                  <div
                    key={item.uuid}
                    style={{
                      ...panelStyle,
                      width: 'calc(50% - 0.5rem)',
                      minWidth: '24rem',
                      background: accent,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem' }}>
                      <div>
                        <div style={{ color: '#fff', fontSize: '1.08rem', textAlign: 'left' }}>{item.name}</div>
                        <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: '0.74rem', textAlign: 'left', marginTop: '0.35rem' }}>
                          {item.uuid}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <ItemTag label={getItemTypeLabel(item.itemType)} accent="rgba(255,255,255,0.14)" />
                        {item.itemType === 'equipment' ? <ItemTag label={getEquipmentSlotLabel(item.itemSubType)} accent="rgba(18, 111, 67, 0.4)" /> : null}
                      </div>
                    </div>

                    <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem', lineHeight: 1.7, textAlign: 'left', marginTop: '0.8rem' }}>
                      {item.description || '暂无物品描述'}
                    </div>

                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.8rem' }}>
                      <div style={{ flex: 1, padding: '0.85rem', borderRadius: '0.85rem', background: 'rgba(255,255,255,0.06)' }}>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textAlign: 'left' }}>{'物品效果'}</div>
                        <div style={{ color: '#fff', fontSize: '0.8rem', lineHeight: 1.7, textAlign: 'left', marginTop: '0.35rem' }}>{item.effectLabel || '--'}</div>
                      </div>
                      <div style={{ flex: 1, padding: '0.85rem', borderRadius: '0.85rem', background: 'rgba(255,255,255,0.06)' }}>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textAlign: 'left' }}>{'叠加上限'}</div>
                        <div style={{ color: '#fff', fontSize: '1.2rem', textAlign: 'left', marginTop: '0.35rem' }}>{item.stackLimit}</div>
                      </div>
                    </div>

                    {item.itemType === 'consumable' ? (
                      <ModifierList
                        title={`使用效果 · ${item.consumableConfig?.maxUses || 1}次`}
                        items={item.consumableConfig?.effects || []}
                        formatter={formatConsumableEffectLabel}
                        emptyText="暂无效果配置"
                      />
                    ) : null}

                    {item.itemType === 'weapon' ? (
                      <>
                        <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.8rem' }}>
                          <div style={{ flex: 1, padding: '0.85rem', borderRadius: '0.85rem', background: 'rgba(255,255,255,0.06)' }}>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textAlign: 'left' }}>{'预估伤害'}</div>
                            <div style={{ color: '#fff', fontSize: '1.2rem', textAlign: 'left', marginTop: '0.35rem' }}>{item.damagePreview ?? '--'}</div>
                          </div>
                          <div style={{ flex: 1, padding: '0.85rem', borderRadius: '0.85rem', background: 'rgba(255,255,255,0.06)' }}>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textAlign: 'left' }}>{'耐久设定'}</div>
                            <div style={{ color: '#fff', fontSize: '0.8rem', lineHeight: 1.7, textAlign: 'left', marginTop: '0.35rem' }}>
                              {`耐久 ${item.weaponConfig?.maxDurability || '--'} / 每次消耗 ${item.weaponConfig?.durabilityCostPerUse || '--'}`}
                            </div>
                          </div>
                        </div>
                        <div style={{ marginTop: '0.9rem' }}>
                          <div style={{ color: '#fff', fontSize: '0.86rem', textAlign: 'left', marginBottom: '0.55rem' }}>{'伤害公式'}</div>
                          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.78rem', lineHeight: 1.7, textAlign: 'left' }}>{formatItemFormula(item)}</div>
                        </div>
                      </>
                    ) : null}

                    {item.itemType === 'equipment' ? (
                      <>
                        <ModifierList title="基础加成" items={item.equipmentConfig?.modifiers || []} />
                        <div style={{ marginTop: '0.9rem' }}>
                          <div style={{ color: '#fff', fontSize: '0.86rem', textAlign: 'left', marginBottom: '0.55rem' }}>{'可出现词条'}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                            {item.equipmentConfig?.bonusAffixes?.length ? item.equipmentConfig.bonusAffixes.map((affix, index) => (
                              <div key={`${item.uuid}-affix-${index}`} style={{ padding: '0.7rem 0.8rem', borderRadius: '0.8rem', background: 'rgba(255,255,255,0.05)' }}>
                                <div style={{ color: '#fff', fontSize: '0.8rem', textAlign: 'left' }}>{affix.name}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.45rem' }}>
                                  {affix.modifiers.map((modifier, modifierIndex) => (
                                    <div key={`${item.uuid}-affix-${index}-${modifierIndex}`} style={{ padding: '0.34rem 0.65rem', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.72rem' }}>
                                      {formatModifierLabel(modifier)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )) : <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.76rem' }}>{'暂无额外词条'}</div>}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <img alt="eng-logo" className="login-eng-logo" src={images.eng_logo} />
    </div>
  );
}
