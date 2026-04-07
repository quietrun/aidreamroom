import { useEffect, useMemo, useState } from 'react';
import { Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import '../styles/index.scss';
import { images } from '../../constant';
import {
  formatConsumableEffectLabel,
  formatItemFormula,
  formatModifierLabel,
  getEquipmentSlotLabel,
  getItemTypeLabel,
  summarizeItemCatalog,
} from '../../constant/item';
import {
  ensureItemList,
  ensureRoleProfile,
  getCachedItemList,
  getCachedRoleProfile,
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

export function MobileItemPage() {
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
          navigate('/mobile/role/create', { replace: true });
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
              <span style={{ fontSize: '0.86rem' }}>{'物品库'}</span>
              <ActionButton label="仓库" onClick={() => navigate('/mobile/warehouse')} />
            </div>

            <div style={cardStyle}>
              <div style={{ color: '#fff', fontSize: '0.76rem', textAlign: 'left', marginBottom: '0.5rem' }}>{'物品概览'}</div>
              <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.56rem', lineHeight: 1.7, textAlign: 'left', marginBottom: '0.65rem' }}>
                物品分为消耗品、武器、装备三类，技能卡在仓库中单独保管。
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {[
                  ['总数', summary.total],
                  ['消耗品', summary.consumables],
                  ['武器', summary.weapons],
                  ['装备', summary.equipments],
                ].map(([label, value]) => (
                  <div key={label} style={{ width: '48%', padding: '0.55rem', borderRadius: '0.65rem', background: 'rgba(255,255,255,0.06)', marginBottom: '0.45rem' }}>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.52rem', textAlign: 'left' }}>{label}</div>
                    <div style={{ color: '#fff', fontSize: '0.7rem', textAlign: 'left', marginTop: '0.2rem' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {items.map((item) => (
              <div
                key={item.uuid}
                style={{
                  ...cardStyle,
                  marginTop: '0.75rem',
                  background: item.itemType === 'weapon'
                    ? 'rgba(140, 59, 32, 0.28)'
                    : item.itemType === 'equipment'
                      ? 'rgba(25, 73, 51, 0.28)'
                      : 'rgba(53, 65, 92, 0.28)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.45rem', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: '0.72rem', textAlign: 'left' }}>{item.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.48rem', textAlign: 'left', marginTop: '0.15rem' }}>{item.uuid}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.22rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <div style={{ padding: '0.22rem 0.45rem', borderRadius: '999px', background: 'rgba(255,255,255,0.14)', color: '#fff', fontSize: '0.48rem' }}>{getItemTypeLabel(item.itemType)}</div>
                    {item.itemType === 'equipment' ? <div style={{ padding: '0.22rem 0.45rem', borderRadius: '999px', background: 'rgba(18, 111, 67, 0.4)', color: '#fff', fontSize: '0.48rem' }}>{getEquipmentSlotLabel(item.itemSubType)}</div> : null}
                  </div>
                </div>

                <div style={{ color: 'rgba(255,255,255,0.74)', fontSize: '0.54rem', lineHeight: 1.65, textAlign: 'left', marginTop: '0.45rem' }}>
                  {item.description || '暂无物品描述'}
                </div>

                <div style={{ color: 'rgba(255,255,255,0.74)', fontSize: '0.54rem', lineHeight: 1.65, textAlign: 'left', marginTop: '0.45rem' }}>
                  {item.effectLabel || '--'}
                </div>

                {item.itemType === 'consumable' ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.28rem', marginTop: '0.45rem' }}>
                    {item.consumableConfig?.effects?.map((effect, index) => (
                      <div key={`${item.uuid}-effect-${index}`} style={{ padding: '0.24rem 0.45rem', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.48rem' }}>
                        {formatConsumableEffectLabel(effect)}
                      </div>
                    ))}
                  </div>
                ) : null}

                {item.itemType === 'weapon' ? (
                  <div style={{ marginTop: '0.45rem', color: 'rgba(255,255,255,0.74)', fontSize: '0.5rem', lineHeight: 1.6, textAlign: 'left' }}>
                    {`耐久 ${item.weaponConfig?.maxDurability || '--'} / 每次消耗 ${item.weaponConfig?.durabilityCostPerUse || '--'} / 预估伤害 ${item.damagePreview ?? '--'}`}
                    <br />
                    {formatItemFormula(item)}
                  </div>
                ) : null}

                {item.itemType === 'equipment' ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.28rem', marginTop: '0.45rem' }}>
                    {item.equipmentConfig?.modifiers?.map((modifier, index) => (
                      <div key={`${item.uuid}-modifier-${index}`} style={{ padding: '0.24rem 0.45rem', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.48rem' }}>
                        {formatModifierLabel(modifier)}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
