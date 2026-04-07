import { useEffect, useMemo, useState } from 'react';
import { Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import '../styles/index.scss';
import { images } from '../../constant';
import {
  formatConsumableEffectLabel,
  formatModifierLabel,
  getEquipmentSlotLabel,
  getItemTypeLabel,
  summarizeWarehouse,
} from '../../constant/item';
import { API } from '../../utils/API';
import {
  commitWarehouseProfile,
  ensureRoleProfile,
  ensureWarehouseProfile,
  getCachedRoleProfile,
  getCachedWarehouseProfile,
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

function ActionButton({ label, onClick, disabled = false }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: '999px',
        padding: '0.45rem 0.7rem',
        color: '#fff',
        background: disabled ? 'rgba(96, 96, 96, 0.55)' : 'rgba(28, 122, 59, 0.85)',
        border: '0.044rem solid rgba(255,255,255,0.12)',
        fontSize: '0.58rem',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {label}
    </div>
  );
}

export function MobileWarehousePage() {
  const navigate = useNavigate();
  const cachedProfile = getCachedWarehouseProfile();
  const cachedRoleResponse = getCachedRoleProfile();
  const [loading, setLoading] = useState(!(cachedProfile && cachedRoleResponse));
  const [expanding, setExpanding] = useState(false);
  const [profile, setProfile] = useState(cachedProfile);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [nextProfile, roleResponse] = await Promise.all([
          ensureWarehouseProfile(),
          ensureRoleProfile(),
        ]);

        if (!mounted) {
          return;
        }

        if (!roleResponse.role) {
          navigate('/mobile/role/create', { replace: true });
          return;
        }

        setProfile(nextProfile);
      } catch (error) {
        console.error(error);
        if (mounted) {
          message.error('仓库加载失败');
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

  const summary = useMemo(() => summarizeWarehouse(profile), [profile]);

  const handleExpand = async () => {
    try {
      setExpanding(true);
      const response = await API.WAREHOUSE_EXPAND({ amount: 10 });
      if (response?.result !== 0) {
        message.error(response?.message || '仓库扩充失败');
        return;
      }

      commitWarehouseProfile(response.profile);
      setProfile(response.profile);
      message.success('已扩充 10 格');
    } catch (error) {
      console.error(error);
      message.error('仓库扩充失败');
    } finally {
      setExpanding(false);
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

  return (
    <div className="mobile-app">
      <div className="main-container" style={{ background: `url(${images.background5})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
        <div className="mainpage-container">
          <div style={{ width: '100%', height: '100%', overflowY: 'auto', padding: '0.75rem 0.6rem 1.2rem', boxSizing: 'border-box' }}>
            <div className="normal-row" style={{ marginBottom: '0.75rem' }}>
              <div className="row">
                <img alt="back" src={images.icon_back} onClick={() => navigate('/mobile/mepage')} />
              </div>
              <span style={{ fontSize: '0.86rem' }}>{'仓库'}</span>
              <ActionButton label={expanding ? '扩充中' : '扩充10格'} onClick={handleExpand} disabled={expanding} />
            </div>

            <div style={cardStyle}>
              <div style={{ color: '#fff', fontSize: '0.76rem', textAlign: 'left', marginBottom: '0.5rem' }}>{'仓库概览'}</div>
              <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.56rem', lineHeight: 1.7, textAlign: 'left', marginBottom: '0.65rem' }}>
                默认 50 格，可扩充。物品、装备和技能卡都会占用仓库空间。
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {[
                  ['已用', `${summary.usedSlots}/${summary.capacity}`],
                  ['空余', summary.freeSlots],
                  ['武器', summary.weapons],
                  ['装备', summary.equipments],
                  ['消耗品', summary.consumables],
                  ['技能卡', summary.skillCards],
                ].map(([label, value]) => (
                  <div key={label} style={{ width: '48%', padding: '0.55rem', borderRadius: '0.65rem', background: 'rgba(255,255,255,0.06)', marginBottom: '0.45rem' }}>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.52rem', textAlign: 'left' }}>{label}</div>
                    <div style={{ color: '#fff', fontSize: '0.7rem', textAlign: 'left', marginTop: '0.2rem' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {profile?.entries?.map((entry) => (
              <div
                key={entry.uuid}
                style={{
                  ...cardStyle,
                  marginTop: '0.75rem',
                  background: entry.entryType === 'skill_card'
                    ? 'rgba(61, 54, 103, 0.32)'
                    : entry.item?.itemType === 'weapon'
                      ? 'rgba(140, 59, 32, 0.28)'
                      : entry.item?.itemType === 'equipment'
                        ? 'rgba(25, 73, 51, 0.28)'
                        : 'rgba(53, 65, 92, 0.28)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.45rem', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: '0.72rem', textAlign: 'left' }}>{entry.displayName}</div>
                    <div style={{ color: 'rgba(255,255,255,0.52)', fontSize: '0.48rem', textAlign: 'left', marginTop: '0.15rem' }}>{entry.uuid}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.22rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <div style={{ padding: '0.22rem 0.45rem', borderRadius: '999px', background: 'rgba(255,255,255,0.14)', color: '#fff', fontSize: '0.48rem' }}>
                      {entry.entryType === 'skill_card' ? '技能卡' : getItemTypeLabel(entry.item?.itemType)}
                    </div>
                    {entry.item?.itemType === 'equipment' ? <div style={{ padding: '0.22rem 0.45rem', borderRadius: '999px', background: 'rgba(18, 111, 67, 0.4)', color: '#fff', fontSize: '0.48rem' }}>{getEquipmentSlotLabel(entry.item?.itemSubType)}</div> : null}
                    {entry.isEquipped ? <div style={{ padding: '0.22rem 0.45rem', borderRadius: '999px', background: 'rgba(187, 120, 21, 0.45)', color: '#fff', fontSize: '0.48rem' }}>已装备</div> : null}
                  </div>
                </div>

                <div style={{ color: 'rgba(255,255,255,0.74)', fontSize: '0.54rem', lineHeight: 1.65, textAlign: 'left', marginTop: '0.45rem' }}>
                  {entry.description || '暂无描述'}
                </div>

                <div style={{ color: 'rgba(255,255,255,0.74)', fontSize: '0.54rem', lineHeight: 1.65, textAlign: 'left', marginTop: '0.35rem' }}>
                  {`数量 ${entry.quantity}`}
                </div>

                {entry.entryType === 'skill_card' ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.28rem', marginTop: '0.45rem' }}>
                    {entry.skill?.requirements?.map((item) => (
                      <div key={`${entry.uuid}-${item.abilityKey}`} style={{ padding: '0.24rem 0.45rem', borderRadius: '999px', background: item.met ? 'rgba(28,122,59,0.18)' : 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.48rem' }}>
                        {`${item.abilityName} ${item.currentLevel}/${item.requiredLevel}`}
                      </div>
                    ))}
                  </div>
                ) : null}

                {entry.item?.itemType === 'consumable' ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.28rem', marginTop: '0.45rem' }}>
                    {entry.item.consumableConfig?.effects?.map((effect, index) => (
                      <div key={`${entry.uuid}-effect-${index}`} style={{ padding: '0.24rem 0.45rem', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.48rem' }}>
                        {formatConsumableEffectLabel(effect)}
                      </div>
                    ))}
                  </div>
                ) : null}

                {entry.item?.itemType === 'weapon' ? (
                  <div style={{ marginTop: '0.45rem', color: 'rgba(255,255,255,0.74)', fontSize: '0.5rem', lineHeight: 1.6, textAlign: 'left' }}>
                    {`耐久 ${entry.durabilityCurrent ?? '--'}/${entry.durabilityMax ?? '--'} · 损坏概率 ${entry.breakRisk !== null ? `${entry.breakRisk}%` : '--'}`}
                    <br />
                    {`预估伤害 ${entry.item.damagePreview ?? '--'}`}
                  </div>
                ) : null}

                {entry.item?.itemType === 'equipment' ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.28rem', marginTop: '0.45rem' }}>
                    {[
                      ...(entry.item.equipmentConfig?.modifiers || []),
                      ...(entry.entryAffixes?.flatMap((affix) => affix.modifiers) || []),
                    ].map((modifier, index) => (
                      <div key={`${entry.uuid}-modifier-${index}`} style={{ padding: '0.24rem 0.45rem', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.48rem' }}>
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
