import { useEffect, useMemo, useState } from 'react';
import { Modal, Spin, message } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';

import '../styles/index.scss';
import { images } from '../../constant';
import {
  formatConsumableEffectLabel,
  formatItemFormula,
  formatModifierLabel,
  getEquipmentSlotLabel,
  getItemTypeLabel,
  summarizeItemCatalog,
  summarizeWarehouse,
} from '../../constant/item';
import { formatSkillFormula, getSkillAbilityLabel, summarizeSkillList } from '../../constant/skill';
import {
  computeRoleAttributeTotal,
  computeRoleDerivedStats,
  getDisplayGender,
  roleAbilityDefinitions,
  roleAttributeDefinitions,
} from '../../constant/userRole';
import {
  commitWarehouseProfile,
  ensureItemList,
  ensureRoleProfile,
  ensureSkillList,
  ensureUserDetail,
  ensureWarehouseProfile,
  getCachedItemList,
  getCachedRoleProfile,
  getCachedSkillList,
  getCachedUserDetail,
  getCachedWarehouseProfile,
  markRoleReset,
} from '../../utils/session';
import { API } from '../../utils/API';

const mobileRoleTabs = [
  { key: 'attributes', label: '属性' },
  { key: 'derived', label: '派生' },
  { key: 'abilities', label: '能力' },
  { key: 'records', label: '记录' },
];

const mobileRoleViewTabs = [
  { key: 'role', label: '角色' },
  { key: 'warehouse', label: '仓库' },
];

const mobileWarehouseTabs = [
  { key: 'warehouse', label: '仓库' },
  { key: 'items', label: '物品' },
  { key: 'skills', label: '技能' },
];

const attributeColors = [
  '#cf7759',
  '#c69a49',
  '#c2bf58',
  '#65bd77',
  '#a66bd5',
  '#6192e4',
  '#8a6ad9',
  '#67c1c8',
  '#d5c865',
];

const roleViewTabKeys = new Set(mobileRoleViewTabs.map((item) => item.key));
const warehouseTabKeys = new Set(mobileWarehouseTabs.map((item) => item.key));

function resolveRolePageState(state) {
  const requestedWarehouseTab = warehouseTabKeys.has(state?.warehouseTab) ? state.warehouseTab : 'warehouse';
  const requestedSection = roleViewTabKeys.has(state?.section)
    ? state.section
    : warehouseTabKeys.has(state?.warehouseTab)
      ? 'warehouse'
      : 'role';

  return {
    section: requestedSection,
    warehouseTab: requestedWarehouseTab,
  };
}

function MobileStatPill({ label, value }) {
  return (
    <span className="mobile-role-stat-pill">
      <em>{label}</em>
      <strong>{value}</strong>
    </span>
  );
}

function MobileAttributeList({ role }) {
  return (
    <div className="mobile-role-attribute-list">
      {roleAttributeDefinitions.map((item, index) => {
        const value = Number(role.attributes?.[item.key] ?? 0);
        const percent = Math.min(100, Math.max(0, (value / 99) * 100));

        return (
          <div key={item.key} className="mobile-role-attribute-card">
            <div>
              <span>{item.label}</span>
              <strong>{value}<em>/99</em></strong>
            </div>
            <i>
              <b style={{ width: `${percent}%`, background: attributeColors[index % attributeColors.length] }} />
            </i>
          </div>
        );
      })}
    </div>
  );
}

function MobileDerivedGrid({ derivedStats, attributeTotal }) {
  return (
    <div className="mobile-role-derived-grid">
      {[
        ['生命上限', derivedStats.maxHp],
        ['魔法上限', derivedStats.maxMp],
        ['负重', derivedStats.carryCapacity],
        ['推举极限', derivedStats.pushLimit],
        ['伤害加值', derivedStats.damageBonus],
        ['移动速率', derivedStats.moveRate],
        ['射击加成', `+${derivedStats.shootBonus}`],
        ['社交加成', `+${derivedStats.socialBonus}`],
        ['学习加成', `+${derivedStats.learningBonus}`],
        ['幸运加成', `+${derivedStats.critBonus}`],
        ['九维总值', attributeTotal],
      ].map(([label, value]) => (
        <div key={label} className="mobile-role-derived-card">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function MobileAbilityList({ abilityMap }) {
  return (
    <div className="mobile-role-info-list">
      {roleAbilityDefinitions.map((item) => {
        const current = abilityMap.get(item.key) || { level: 0, experience: 0 };
        return (
          <div key={item.key} className="mobile-role-info-card">
            <div>
              <strong>{item.label}</strong>
              <span>{`等级 ${current.level} / 10 · 经验 ${current.experience}`}</span>
            </div>
            <p>{item.description}</p>
          </div>
        );
      })}
    </div>
  );
}

function MobileRecordList({ role, counts }) {
  return (
    <div className="mobile-role-info-list">
      <div className="mobile-role-info-card">
        <div>
          <strong>冒险统计</strong>
          <span>{`剧本 ${counts.play}`}</span>
        </div>
      </div>
      <div className="mobile-role-info-card">
        <div>
          <strong>获得物品</strong>
          <span>{role.items?.length ? `${role.items.length} 项` : '暂无记录'}</span>
        </div>
        <div className="mobile-role-chip-list">
          {role.items?.length ? role.items.map((item) => <em key={item}>{item}</em>) : null}
        </div>
      </div>
      <div className="mobile-role-info-card">
        <div>
          <strong>经历世界</strong>
          <span>{role.worlds?.length ? `${role.worlds.length} 个` : '暂无记录'}</span>
        </div>
        <div className="mobile-role-chip-list">
          {role.worlds?.length ? role.worlds.map((item) => <em key={item}>{item}</em>) : null}
        </div>
      </div>
    </div>
  );
}

function MobileSegmentedSwitch({ tabs, activeKey, onChange, compact = false }) {
  return (
    <div className={`mobile-role-segmented-switch${compact ? ' mobile-role-segmented-switch--compact' : ''}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={activeKey === tab.key ? 'active' : ''}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function MobileInventoryToolbar({ title, description, action }) {
  return (
    <section className="mobile-role-inventory-toolbar">
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {action}
    </section>
  );
}

function MobileInventorySummaryGrid({ stats }) {
  return (
    <div className="mobile-role-summary-grid">
      {stats.map(([label, value]) => (
        <div key={label} className="mobile-role-summary-card">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function MobileInventoryTag({ children, tone = 'neutral' }) {
  return <span className={`mobile-role-entry-tag mobile-role-entry-tag--${tone}`}>{children}</span>;
}

function MobileInventoryEmpty({ text }) {
  return <div className="mobile-role-empty">{text}</div>;
}

function MobileWarehouseList({ entries }) {
  if (!entries.length) {
    return <MobileInventoryEmpty text="仓库里还没有物品、装备或技能卡。" />;
  }

  return (
    <div className="mobile-role-entry-list">
      {entries.map((entry) => {
        const tone = entry.entryType === 'skill_card'
          ? 'skillcard'
          : entry.item?.itemType === 'weapon'
            ? 'weapon'
            : entry.item?.itemType === 'equipment'
              ? 'equipment'
              : 'consumable';
        const equipmentModifiers = [
          ...(entry.item?.equipmentConfig?.modifiers || []),
          ...(entry.entryAffixes?.flatMap((affix) => affix.modifiers) || []),
        ];

        return (
          <article key={entry.uuid} className={`mobile-role-entry-card mobile-role-entry-card--${tone}`}>
            <div className="mobile-role-entry-head">
              <div className="mobile-role-entry-copy">
                <strong>{entry.displayName}</strong>
                <span>{entry.uuid}</span>
              </div>
              <div className="mobile-role-entry-tags">
                <MobileInventoryTag>{entry.entryType === 'skill_card' ? '技能卡' : getItemTypeLabel(entry.item?.itemType)}</MobileInventoryTag>
                {entry.item?.itemType === 'equipment' ? <MobileInventoryTag tone="emerald">{getEquipmentSlotLabel(entry.item?.itemSubType)}</MobileInventoryTag> : null}
                {entry.isEquipped ? <MobileInventoryTag tone="amber">已装备</MobileInventoryTag> : null}
              </div>
            </div>

            <p className="mobile-role-entry-desc">{entry.description || '暂无描述'}</p>
            <div className="mobile-role-entry-meta">{`数量 ${entry.quantity}`}</div>

            {entry.entryType === 'skill_card' ? (
              <div className="mobile-role-entry-chiplist">
                {entry.skill?.requirements?.map((item) => (
                  <em key={`${entry.uuid}-${item.abilityKey}`} className={item.met ? 'is-success' : ''}>
                    {`${item.abilityName} ${item.currentLevel}/${item.requiredLevel}`}
                  </em>
                ))}
              </div>
            ) : null}

            {entry.item?.itemType === 'consumable' ? (
              <div className="mobile-role-entry-chiplist">
                {entry.item.consumableConfig?.effects?.map((effect, index) => (
                  <em key={`${entry.uuid}-effect-${index}`}>{formatConsumableEffectLabel(effect)}</em>
                ))}
              </div>
            ) : null}

            {entry.item?.itemType === 'weapon' ? (
              <div className="mobile-role-entry-detail">
                {`耐久 ${entry.durabilityCurrent ?? '--'}/${entry.durabilityMax ?? '--'} · 损坏概率 ${entry.breakRisk != null ? `${entry.breakRisk}%` : '--'}`}
                <br />
                {`预估伤害 ${entry.item.damagePreview ?? '--'}`}
              </div>
            ) : null}

            {entry.item?.itemType === 'equipment' && equipmentModifiers.length ? (
              <div className="mobile-role-entry-chiplist">
                {equipmentModifiers.map((modifier, index) => (
                  <em key={`${entry.uuid}-modifier-${index}`}>{formatModifierLabel(modifier)}</em>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function MobileItemList({ items }) {
  if (!items.length) {
    return <MobileInventoryEmpty text="当前物品库还是空的。" />;
  }

  return (
    <div className="mobile-role-entry-list">
      {items.map((item) => (
        <article key={item.uuid} className={`mobile-role-entry-card mobile-role-entry-card--${item.itemType || 'consumable'}`}>
          <div className="mobile-role-entry-head">
            <div className="mobile-role-entry-copy">
              <strong>{item.name}</strong>
              <span>{item.uuid}</span>
            </div>
            <div className="mobile-role-entry-tags">
              <MobileInventoryTag>{getItemTypeLabel(item.itemType)}</MobileInventoryTag>
              {item.itemType === 'equipment' ? <MobileInventoryTag tone="emerald">{getEquipmentSlotLabel(item.itemSubType)}</MobileInventoryTag> : null}
            </div>
          </div>

          <p className="mobile-role-entry-desc">{item.description || '暂无物品描述'}</p>
          <div className="mobile-role-entry-detail">{item.effectLabel || '--'}</div>

          {item.itemType === 'consumable' ? (
            <div className="mobile-role-entry-chiplist">
              {item.consumableConfig?.effects?.map((effect, index) => (
                <em key={`${item.uuid}-effect-${index}`}>{formatConsumableEffectLabel(effect)}</em>
              ))}
            </div>
          ) : null}

          {item.itemType === 'weapon' ? (
            <div className="mobile-role-entry-detail">
              {`耐久 ${item.weaponConfig?.maxDurability || '--'} / 每次消耗 ${item.weaponConfig?.durabilityCostPerUse || '--'} / 预估伤害 ${item.damagePreview ?? '--'}`}
              <br />
              {formatItemFormula(item)}
            </div>
          ) : null}

          {item.itemType === 'equipment' ? (
            <div className="mobile-role-entry-chiplist">
              {item.equipmentConfig?.modifiers?.map((modifier, index) => (
                <em key={`${item.uuid}-modifier-${index}`}>{formatModifierLabel(modifier)}</em>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function MobileSkillList({ skills }) {
  if (!skills.length) {
    return <MobileInventoryEmpty text="当前还没有技能可查看。" />;
  }

  return (
    <div className="mobile-role-entry-list">
      {skills.map((skill) => (
        <article key={skill.uuid} className={`mobile-role-entry-card mobile-role-entry-card--${skill.available ? 'skill' : 'locked'}`}>
          <div className="mobile-role-entry-head">
            <div className="mobile-role-entry-copy">
              <strong>{skill.name}</strong>
              <span>{skill.uuid}</span>
            </div>
            <div className="mobile-role-entry-tags">
              <MobileInventoryTag tone={skill.available ? 'success' : 'amber'}>{skill.available ? '可用' : '未达成'}</MobileInventoryTag>
            </div>
          </div>

          <p className="mobile-role-entry-desc">{skill.description || '暂无技能描述'}</p>

          <div className="mobile-role-skill-grid">
            <div className="mobile-role-summary-card">
              <span>预估伤害</span>
              <strong>{skill.damagePreview ?? '--'}</strong>
            </div>
            <div className="mobile-role-summary-card">
              <span>伤害公式</span>
              <strong className="mobile-role-summary-card__formula">{formatSkillFormula(skill)}</strong>
            </div>
          </div>

          <div className="mobile-role-entry-subtitle">能力要求</div>
          <div className="mobile-role-entry-chiplist">
            {skill.requirements?.length ? skill.requirements.map((item) => (
              <em key={`${skill.uuid}-${item.abilityKey}`} className={item.met ? 'is-success' : ''}>
                {`${getSkillAbilityLabel(item.abilityKey, item.abilityName)} ${item.currentLevel}/${item.requiredLevel}`}
              </em>
            )) : <em className="is-success">无门槛要求</em>}
          </div>
        </article>
      ))}
    </div>
  );
}

export function MobileMePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const cachedRoleResponse = getCachedRoleProfile();
  const cachedUserDetail = getCachedUserDetail();
  const cachedWarehouseProfile = getCachedWarehouseProfile();
  const cachedItems = getCachedItemList();
  const cachedSkills = getCachedSkillList();
  const initialPageState = resolveRolePageState(location.state);
  const [loading, setLoading] = useState(!(cachedRoleResponse && cachedUserDetail));
  const [inventoryLoading, setInventoryLoading] = useState(!(cachedWarehouseProfile && cachedItems && cachedSkills));
  const [warehouseExpanding, setWarehouseExpanding] = useState(false);
  const [detail, setDetail] = useState(cachedUserDetail);
  const [role, setRole] = useState(cachedRoleResponse?.role || null);
  const [warehouseProfile, setWarehouseProfile] = useState(cachedWarehouseProfile);
  const [items, setItems] = useState(cachedItems || []);
  const [skills, setSkills] = useState(cachedSkills || []);
  const [activeSection, setActiveSection] = useState(initialPageState.section);
  const [activeTab, setActiveTab] = useState('attributes');
  const [activeWarehouseTab, setActiveWarehouseTab] = useState(initialPageState.warehouseTab);

  useEffect(() => {
    const nextPageState = resolveRolePageState(location.state);

    if (location.state?.section || location.state?.warehouseTab) {
      setActiveSection(nextPageState.section);
      setActiveWarehouseTab(nextPageState.warehouseTab);
    }
  }, [location.state]);

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
          navigate('/mobile/role/create', { replace: true });
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

  useEffect(() => {
    if (!role) {
      return undefined;
    }

    let mounted = true;

    async function initInventory() {
      try {
        const [nextWarehouseProfile, nextItems, nextSkills] = await Promise.all([
          ensureWarehouseProfile(),
          ensureItemList(),
          ensureSkillList(),
        ]);

        if (!mounted) {
          return;
        }

        setWarehouseProfile(nextWarehouseProfile);
        setItems(nextItems || []);
        setSkills(nextSkills || []);
      } catch (error) {
        console.error(error);
        if (mounted) {
          message.error('仓库信息加载失败');
        }
      } finally {
        if (mounted) {
          setInventoryLoading(false);
        }
      }
    }

    initInventory();

    return () => {
      mounted = false;
    };
  }, [role]);

  const derivedStats = useMemo(() => (role?.derived ? role.derived : computeRoleDerivedStats(role)), [role]);
  const abilityMap = useMemo(() => new Map((role?.abilities || []).map((item) => [item.abilityKey, item])), [role]);
  const attributeTotal = useMemo(() => computeRoleAttributeTotal(role || {}), [role]);
  const counts = {
    play: detail?.play?.length || 0,
  };
  const warehouseSummary = useMemo(() => summarizeWarehouse(warehouseProfile), [warehouseProfile]);
  const itemSummary = useMemo(() => summarizeItemCatalog(items), [items]);
  const skillSummary = useMemo(() => summarizeSkillList(skills), [skills]);

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
        navigate('/mobile/role/create', { replace: true });
        return undefined;
      },
    });
  };

  const expandWarehouse = async () => {
    try {
      setWarehouseExpanding(true);
      const response = await API.WAREHOUSE_EXPAND({ amount: 10 });

      if (response?.result !== 0) {
        message.error(response?.message || '仓库扩充失败');
        return;
      }

      commitWarehouseProfile(response.profile);
      setWarehouseProfile(response.profile);
      message.success('已扩充 10 格');
    } catch (error) {
      console.error(error);
      message.error('仓库扩充失败');
    } finally {
      setWarehouseExpanding(false);
    }
  };

  const renderRoleContent = () => (
    <>
      {activeTab === 'attributes' ? <MobileAttributeList role={role} /> : null}
      {activeTab === 'derived' ? <MobileDerivedGrid derivedStats={derivedStats} attributeTotal={attributeTotal} /> : null}
      {activeTab === 'abilities' ? <MobileAbilityList abilityMap={abilityMap} /> : null}
      {activeTab === 'records' ? <MobileRecordList role={role} counts={counts} /> : null}
      {activeTab === 'records' ? (
        <button className="mobile-role-reset" type="button" onClick={resetRole}>重生</button>
      ) : null}
    </>
  );

  const renderWarehouseContent = () => {
    if (inventoryLoading && !warehouseProfile && !items.length && !skills.length) {
      return (
        <div className="mobile-role-loading">
          <Spin />
        </div>
      );
    }

    if (activeWarehouseTab === 'warehouse') {
      const warehouseEntries = Array.isArray(warehouseProfile?.entries) ? warehouseProfile.entries : [];

      return (
        <>
          <MobileInventoryToolbar
            title="仓库概览"
            description={`已用 ${warehouseSummary.usedSlots}/${warehouseSummary.capacity}，物品、装备和技能卡都会占用仓库空间。`}
            action={(
              <button
                className="mobile-role-toolbar-button"
                type="button"
                onClick={expandWarehouse}
                disabled={warehouseExpanding}
              >
                {warehouseExpanding ? '扩充中' : '扩充10格'}
              </button>
            )}
          />
          <MobileInventorySummaryGrid
            stats={[
              ['已用', `${warehouseSummary.usedSlots}/${warehouseSummary.capacity}`],
              ['空余', warehouseSummary.freeSlots],
              ['武器', warehouseSummary.weapons],
              ['装备', warehouseSummary.equipments],
              ['消耗品', warehouseSummary.consumables],
              ['技能卡', warehouseSummary.skillCards],
            ]}
          />
          <MobileWarehouseList entries={warehouseEntries} />
        </>
      );
    }

    if (activeWarehouseTab === 'items') {
      return (
        <>
          <MobileInventoryToolbar
            title="物品库"
            description="消耗品、武器、装备都会收纳在这里，技能卡独立保存在仓库。"
          />
          <MobileInventorySummaryGrid
            stats={[
              ['总数', itemSummary.total],
              ['消耗品', itemSummary.consumables],
              ['武器', itemSummary.weapons],
              ['装备', itemSummary.equipments],
            ]}
          />
          <MobileItemList items={items} />
        </>
      );
    }

    return (
      <>
        <MobileInventoryToolbar
          title="技能库"
          description={role ? `${role.name} 当前可查看技能门槛与预估伤害。` : '当前角色信息缺失。'}
        />
        <MobileInventorySummaryGrid
          stats={[
            ['总技能数', skillSummary.total],
            ['可用技能', skillSummary.availableCount],
            ['未达成', skillSummary.unavailableCount],
            ['最高伤害', skillSummary.highestDamageSkill ? skillSummary.highestDamageSkill.damagePreview ?? 0 : '--'],
          ]}
        />
        <MobileSkillList skills={skills} />
      </>
    );
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
      <div className="main-container mobile-role-page" style={{ background: `url(${images.background5})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
        <div className="mobile-role-shell">
          <header className="mobile-role-header">
            <button className="mobile-round-icon" type="button" onClick={() => navigate('/mobile/main')}>
              <img alt="back" src={images.icon_back} />
            </button>
            <strong>我的角色</strong>
            <MobileSegmentedSwitch
              tabs={mobileRoleViewTabs}
              activeKey={activeSection}
              onChange={setActiveSection}
              compact
            />
          </header>

          <section className="mobile-role-profile">
            <img alt="avatar" src={images.avater} />
            <div>
              <h1>{role.name}</h1>
              <p>{`${getDisplayGender(role.gender)} · ${role.age}岁 · 经验 ${role.experience}`}</p>
              <div>
                <MobileStatPill label="HP" value={derivedStats.maxHp} />
                <MobileStatPill label="MP" value={derivedStats.maxMp} />
                <MobileStatPill label="九维" value={attributeTotal} />
              </div>
            </div>
          </section>

          <p className="mobile-role-intro">{role.appearanceStyle || '暂未填写外观样式'}</p>

          <nav
            className="mobile-role-tabs"
            style={{ gridTemplateColumns: `repeat(${activeSection === 'role' ? mobileRoleTabs.length : mobileWarehouseTabs.length}, minmax(0, 1fr))` }}
          >
            {(activeSection === 'role' ? mobileRoleTabs : mobileWarehouseTabs).map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={(activeSection === 'role' ? activeTab : activeWarehouseTab) === tab.key ? 'active' : ''}
                onClick={() => {
                  if (activeSection === 'role') {
                    setActiveTab(tab.key);
                    return;
                  }

                  setActiveWarehouseTab(tab.key);
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <main className="mobile-role-content">
            {activeSection === 'role' ? renderRoleContent() : renderWarehouseContent()}
          </main>
        </div>
      </div>
    </div>
  );
}
