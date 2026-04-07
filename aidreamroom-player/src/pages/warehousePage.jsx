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
  summarizeWarehouse,
} from '../constant/item';
import { API } from '../utils/API';
import {
  commitWarehouseProfile,
  ensureRoleProfile,
  ensureWarehouseProfile,
  getCachedRoleProfile,
  getCachedWarehouseProfile,
} from '../utils/session';

const panelStyle = {
  background: 'rgba(0, 0, 0, 0.28)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '1rem',
  padding: '1rem',
  color: '#fff',
};

function ActionButton({ label, onClick, disabled = false }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: '999px',
        padding: '0.65rem 1.2rem',
        color: '#fff',
        background: disabled ? 'rgba(96, 96, 96, 0.55)' : 'rgba(28, 122, 59, 0.85)',
        border: '1px solid rgba(255,255,255,0.12)',
        fontSize: '0.9rem',
        opacity: disabled ? 0.7 : 1,
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

function WarehouseCard({ entry }) {
  if (entry.entryType === 'skill_card') {
    return (
      <div
        style={{
          ...panelStyle,
          width: 'calc(50% - 0.5rem)',
          minWidth: '24rem',
          background: 'rgba(61, 54, 103, 0.32)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem' }}>
          <div>
            <div style={{ color: '#fff', fontSize: '1.08rem', textAlign: 'left' }}>{entry.displayName}</div>
            <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: '0.74rem', textAlign: 'left', marginTop: '0.35rem' }}>{entry.uuid}</div>
          </div>
          <div style={{ padding: '0.35rem 0.7rem', borderRadius: '999px', background: 'rgba(255,255,255,0.14)', color: '#fff', fontSize: '0.72rem' }}>技能卡</div>
        </div>

        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem', lineHeight: 1.7, textAlign: 'left', marginTop: '0.8rem' }}>
          {entry.description || '暂无技能说明'}
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.8rem' }}>
          <div style={{ flex: 1, padding: '0.85rem', borderRadius: '0.85rem', background: 'rgba(255,255,255,0.06)' }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textAlign: 'left' }}>{'数量'}</div>
            <div style={{ color: '#fff', fontSize: '1.2rem', textAlign: 'left', marginTop: '0.35rem' }}>{entry.quantity}</div>
          </div>
          <div style={{ flex: 1, padding: '0.85rem', borderRadius: '0.85rem', background: 'rgba(255,255,255,0.06)' }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textAlign: 'left' }}>{'预估伤害'}</div>
            <div style={{ color: '#fff', fontSize: '1.2rem', textAlign: 'left', marginTop: '0.35rem' }}>{entry.skill?.damagePreview ?? '--'}</div>
          </div>
        </div>

        <div style={{ marginTop: '0.9rem' }}>
          <div style={{ color: '#fff', fontSize: '0.86rem', textAlign: 'left', marginBottom: '0.55rem' }}>{'技能要求'}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {entry.skill?.requirements?.length ? entry.skill.requirements.map((item) => (
              <div key={`${entry.uuid}-${item.abilityKey}`} style={{ padding: '0.4rem 0.75rem', borderRadius: '999px', background: item.met ? 'rgba(28,122,59,0.24)' : 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.76rem' }}>
                {`${item.abilityName} ${item.currentLevel}/${item.requiredLevel}`}
              </div>
            )) : <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.76rem' }}>{'暂无要求'}</div>}
          </div>
        </div>
      </div>
    );
  }

  const item = entry.item;
  return (
    <div
      style={{
        ...panelStyle,
        width: 'calc(50% - 0.5rem)',
        minWidth: '24rem',
        background: item?.itemType === 'weapon'
          ? 'rgba(140, 59, 32, 0.28)'
          : item?.itemType === 'equipment'
            ? 'rgba(25, 73, 51, 0.28)'
            : 'rgba(53, 65, 92, 0.28)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: '#fff', fontSize: '1.08rem', textAlign: 'left' }}>{entry.displayName}</div>
          <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: '0.74rem', textAlign: 'left', marginTop: '0.35rem' }}>{entry.uuid}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ padding: '0.35rem 0.7rem', borderRadius: '999px', background: 'rgba(255,255,255,0.14)', color: '#fff', fontSize: '0.72rem' }}>
            {getItemTypeLabel(item?.itemType)}
          </div>
          {item?.itemType === 'equipment' ? (
            <div style={{ padding: '0.35rem 0.7rem', borderRadius: '999px', background: 'rgba(18, 111, 67, 0.4)', color: '#fff', fontSize: '0.72rem' }}>
              {getEquipmentSlotLabel(item?.itemSubType)}
            </div>
          ) : null}
          {entry.isEquipped ? (
            <div style={{ padding: '0.35rem 0.7rem', borderRadius: '999px', background: 'rgba(187, 120, 21, 0.45)', color: '#fff', fontSize: '0.72rem' }}>
              已装备
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem', lineHeight: 1.7, textAlign: 'left', marginTop: '0.8rem' }}>
        {entry.description || '暂无物品描述'}
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.8rem' }}>
        <div style={{ flex: 1, padding: '0.85rem', borderRadius: '0.85rem', background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textAlign: 'left' }}>{'数量'}</div>
          <div style={{ color: '#fff', fontSize: '1.2rem', textAlign: 'left', marginTop: '0.35rem' }}>{entry.quantity}</div>
        </div>
        <div style={{ flex: 1, padding: '0.85rem', borderRadius: '0.85rem', background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textAlign: 'left' }}>{'效果'}</div>
          <div style={{ color: '#fff', fontSize: '0.8rem', lineHeight: 1.7, textAlign: 'left', marginTop: '0.35rem' }}>{item?.effectLabel || '--'}</div>
        </div>
      </div>

      {item?.itemType === 'consumable' ? (
        <div style={{ marginTop: '0.9rem' }}>
          <div style={{ color: '#fff', fontSize: '0.86rem', textAlign: 'left', marginBottom: '0.55rem' }}>{`剩余次数 ${entry.remainingUses ?? item.consumableConfig?.maxUses ?? '--'}`}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {item.consumableConfig?.effects?.length ? item.consumableConfig.effects.map((effect, index) => (
              <div key={`${entry.uuid}-effect-${index}`} style={{ padding: '0.4rem 0.75rem', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.76rem' }}>
                {formatConsumableEffectLabel(effect)}
              </div>
            )) : <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.76rem' }}>{'暂无效果配置'}</div>}
          </div>
        </div>
      ) : null}

      {item?.itemType === 'weapon' ? (
        <>
          <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.8rem' }}>
            <div style={{ flex: 1, padding: '0.85rem', borderRadius: '0.85rem', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textAlign: 'left' }}>{'当前耐久'}</div>
              <div style={{ color: '#fff', fontSize: '1.1rem', textAlign: 'left', marginTop: '0.35rem' }}>{`${entry.durabilityCurrent ?? '--'} / ${entry.durabilityMax ?? '--'}`}</div>
            </div>
            <div style={{ flex: 1, padding: '0.85rem', borderRadius: '0.85rem', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', textAlign: 'left' }}>{'损坏概率'}</div>
              <div style={{ color: '#fff', fontSize: '1.1rem', textAlign: 'left', marginTop: '0.35rem' }}>{entry.breakRisk !== null ? `${entry.breakRisk}%` : '--'}</div>
            </div>
          </div>
          <div style={{ marginTop: '0.9rem', color: 'rgba(255,255,255,0.75)', fontSize: '0.78rem', lineHeight: 1.7, textAlign: 'left' }}>
            {`预估伤害 ${item.damagePreview ?? '--'} · ${formatItemFormula(item)}`}
          </div>
        </>
      ) : null}

      {item?.itemType === 'equipment' ? (
        <>
          <div style={{ marginTop: '0.9rem' }}>
            <div style={{ color: '#fff', fontSize: '0.86rem', textAlign: 'left', marginBottom: '0.55rem' }}>{'基础加成'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {item.equipmentConfig?.modifiers?.length ? item.equipmentConfig.modifiers.map((modifier, index) => (
                <div key={`${entry.uuid}-modifier-${index}`} style={{ padding: '0.4rem 0.75rem', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.76rem' }}>
                  {formatModifierLabel(modifier)}
                </div>
              )) : <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.76rem' }}>{'暂无基础加成'}</div>}
            </div>
          </div>
          <div style={{ marginTop: '0.9rem' }}>
            <div style={{ color: '#fff', fontSize: '0.86rem', textAlign: 'left', marginBottom: '0.55rem' }}>{'当前词条'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {entry.entryAffixes?.length ? entry.entryAffixes.map((affix, index) => (
                <div key={`${entry.uuid}-affix-${index}`} style={{ padding: '0.7rem 0.8rem', borderRadius: '0.8rem', background: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ color: '#fff', fontSize: '0.8rem', textAlign: 'left' }}>{affix.name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.45rem' }}>
                    {affix.modifiers.map((modifier, modifierIndex) => (
                      <div key={`${entry.uuid}-affix-${index}-${modifierIndex}`} style={{ padding: '0.34rem 0.65rem', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.72rem' }}>
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
}

export function WarehousePage() {
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
          navigate('/role/create', { replace: true });
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
      message.success('仓库已扩充 10 格');
    } catch (error) {
      console.error(error);
      message.error('仓库扩充失败');
    } finally {
      setExpanding(false);
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
            <span style={{ fontSize: '1.35rem' }}>{'仓库'}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.8rem' }}>
            <ActionButton label="物品库" onClick={() => navigate('/items')} />
            <ActionButton label={expanding ? '扩充中...' : '扩充 10 格'} onClick={handleExpand} disabled={expanding} />
          </div>
        </div>

        <div style={{ display: 'flex', width: '100%', flex: 1, gap: '1rem', overflow: 'hidden' }}>
          <div style={{ width: '20rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
            <div style={panelStyle}>
              <div style={{ color: '#fff', fontSize: '1rem', textAlign: 'left', marginBottom: '0.8rem' }}>{'仓库概览'}</div>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.86rem', lineHeight: 1.7, textAlign: 'left', marginBottom: '0.9rem' }}>
                玩家拥有独立仓库，默认 50 格，可扩充。物品、装备与技能卡都会分别占用格子，装备可携带额外词条。
              </div>
              <SummaryItem label="已用空间" value={`${summary.usedSlots} / ${summary.capacity}`} />
              <SummaryItem label="空余格数" value={summary.freeSlots} />
              <SummaryItem label="消耗品堆" value={summary.consumables} />
              <SummaryItem label="武器数" value={summary.weapons} />
              <SummaryItem label="装备数" value={summary.equipments} />
              <SummaryItem label="技能卡" value={summary.skillCards} />
              <SummaryItem label="已装备" value={summary.equippedCount} />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              {profile?.entries?.map((entry) => (
                <WarehouseCard key={entry.uuid} entry={entry} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <img alt="eng-logo" className="login-eng-logo" src={images.eng_logo} />
    </div>
  );
}
