import { useEffect, useMemo, useState } from 'react';
import { Modal, Spin, message } from 'antd';
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
  summarizeWarehouse,
} from '../constant/item';
import { formatSkillFormula, getSkillAbilityLabel, summarizeSkillList } from '../constant/skill';
import {
  computeRoleAttributeTotal,
  computeRoleDerivedStats,
  getDisplayGender,
  roleAbilityDefinitions,
  roleAttributeDefinitions,
} from '../constant/userRole';
import { API } from '../utils/API';
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
} from '../utils/session';

const primaryTabs = [
  { key: 'attributes', label: '九维属性', tone: 'gold' },
  { key: 'abilities', label: '能力树', tone: 'gold' },
  { key: 'records', label: '角色记录', tone: 'gold' },
];

const libraryTabs = [
  { key: 'skills', label: '技能库', tone: 'gold' },
  { key: 'equipment', label: '装备库', tone: 'blue' },
  { key: 'warehouse', label: '仓库', tone: 'gold' },
];

const shortcutTabs = [
  { key: 'skills', label: '技能库' },
  { key: 'equipment', label: '装备库' },
  { key: 'warehouse', label: '仓库' },
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

function ActionButton({
  label,
  onClick,
  danger = false,
  active = false,
  wide = false,
}) {
  return (
    <button
      className={`role-action-button ${danger ? 'danger' : ''} ${active ? 'active' : ''} ${wide ? 'wide' : ''}`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function SideCardTitle({ children }) {
  return (
    <div className="role-side-card-title">
      <span>{children}</span>
      <i />
    </div>
  );
}

function PanelSectionHeader({ title, meta, actions = null }) {
  return (
    <div className="role-panel-section-header">
      <div className="role-panel-section-title">
        <i />
        <h2>{title}</h2>
        {meta ? <span>{meta}</span> : null}
      </div>
      {actions ? <div className="role-panel-section-actions">{actions}</div> : null}
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="role-stat-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyTag({ text }) {
  return <div className="role-empty-text">{text}</div>;
}

function Chip({ children, tone = 'default' }) {
  return <span className={`role-chip ${tone}`}>{children}</span>;
}

function MetaPill({ children, tone = 'default' }) {
  return <span className={`role-meta-pill ${tone}`}>{children}</span>;
}

function StatusPill({ children, tone = 'default' }) {
  return <span className={`role-status-pill ${tone}`}>{children}</span>;
}

function MetricBox({ label, value }) {
  return (
    <div className="role-library-metric-box">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AttributeCard({ item, value, color }) {
  const percent = Math.min(100, Math.max(0, (Number(value || 0) / 99) * 100));

  return (
    <div className="role-attribute-card">
      <div className="role-card-title-row">
        <span>{item.label}</span>
        <strong>{value}<em>/99</em></strong>
      </div>
      <div className="role-progress-track">
        <i style={{ width: `${percent}%`, background: color }} />
      </div>
      <p>{item.description}</p>
    </div>
  );
}

function AbilityCard({ item, current }) {
  const level = Math.min(10, Math.max(0, Number(current.level || 0)));

  return (
    <div className="role-ability-card">
      <div className="role-card-title-row">
        <span>{item.label}</span>
        <strong>{`Lv.${level}`}</strong>
      </div>
      <div className="role-ability-segments">
        {Array.from({ length: 10 }).map((_, index) => (
          <i key={`${item.key}-${index}`} className={index < level ? 'active' : ''} />
        ))}
      </div>
      <div className="role-ability-footer">
        <p>{item.description}</p>
        <span>{`经验 ${current.experience || 0}`}</span>
      </div>
    </div>
  );
}

function RecordGroup({ title, children }) {
  return (
    <div className="role-record-group">
      <h3>{title}</h3>
      <div className="role-record-chip-list">{children}</div>
    </div>
  );
}

function ContentPlaceholder({ loading = false, text }) {
  return (
    <div className="role-content-placeholder">
      {loading ? <Spin /> : <EmptyTag text={text} />}
    </div>
  );
}

function LibraryPillRow({ items, formatter, emptyText, tone = 'default' }) {
  if (!items?.length) {
    return <EmptyTag text={emptyText} />;
  }

  return (
    <div className="role-library-pill-row">
      {items.map((item, index) => (
        <MetaPill key={`${tone}-${index}`} tone={tone}>
          {formatter(item)}
        </MetaPill>
      ))}
    </div>
  );
}

function AffixList({ affixes, emptyText, compact = false }) {
  if (!affixes?.length) {
    return <EmptyTag text={emptyText} />;
  }

  return (
    <div className={`role-affix-list ${compact ? 'compact' : ''}`}>
      {affixes.map((affix, index) => (
        <div key={`${affix.name || 'affix'}-${index}`} className="role-affix-card">
          <strong>{affix.name || '未命名词条'}</strong>
          <div className="role-library-pill-row">
            {(affix.modifiers || []).map((modifier, modifierIndex) => (
              <MetaPill key={`${affix.name || 'affix'}-${modifierIndex}`}>
                {formatModifierLabel(modifier)}
              </MetaPill>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatSkillRequirement(requirement) {
  const label = getSkillAbilityLabel(requirement?.abilityKey, requirement?.abilityName || '');
  return `${label} Lv.${requirement?.requiredLevel ?? 0}`;
}

function getItemCardTone(itemType) {
  if (itemType === 'weapon') {
    return 'weapon';
  }

  if (itemType === 'equipment') {
    return 'equipment';
  }

  return 'consumable';
}

function SkillLibraryCard({ skill }) {
  return (
    <article className={`role-library-card role-skill-card ${skill.available ? 'is-ready' : 'is-locked'}`}>
      <div className="role-library-card-top">
        <div>
          <h3>{skill.name}</h3>
          <p>{skill.description || '暂无技能描述'}</p>
        </div>
        <StatusPill tone={skill.available ? 'success' : 'warning'}>
          {skill.available ? '已达成' : '未达成'}
        </StatusPill>
      </div>

      <div className="role-library-metric-grid">
        <MetricBox label="预估伤害" value={skill.damagePreview ?? '--'} />
        <MetricBox label="伤害公式" value={formatSkillFormula(skill)} />
      </div>

      <div className="role-library-block">
        <div className="role-library-block-title">能力要求</div>
        {skill.requirements?.length ? (
          <div className="role-library-pill-row">
            {skill.requirements.map((item) => (
              <MetaPill key={`${skill.uuid}-${item.abilityKey}`} tone={item.met ? 'success' : 'muted'}>
                {formatSkillRequirement(item)}
              </MetaPill>
            ))}
          </div>
        ) : (
          <EmptyTag text="无门槛要求" />
        )}
      </div>
    </article>
  );
}

function EquipmentLibraryCard({ item }) {
  return (
    <article className={`role-library-card role-item-card tone-${getItemCardTone(item.itemType)}`}>
      <div className="role-library-card-top">
        <div>
          <h3>{item.name}</h3>
          <p>{item.description || '暂无物品描述'}</p>
        </div>
        <div className="role-library-tag-group">
          <MetaPill>{getItemTypeLabel(item.itemType)}</MetaPill>
          {item.itemType === 'equipment' ? (
            <MetaPill tone="success">{getEquipmentSlotLabel(item.itemSubType)}</MetaPill>
          ) : null}
        </div>
      </div>

      <div className="role-library-metric-grid">
        <MetricBox label="物品效果" value={item.effectLabel || '--'} />
        <MetricBox label="叠加上限" value={item.stackLimit ?? '--'} />
      </div>

      {item.itemType === 'consumable' ? (
        <div className="role-library-block">
          <div className="role-library-block-title">{`使用效果 · ${item.consumableConfig?.maxUses || 1}次`}</div>
          <LibraryPillRow
            items={item.consumableConfig?.effects || []}
            formatter={formatConsumableEffectLabel}
            emptyText="暂无效果配置"
            tone="info"
          />
        </div>
      ) : null}

      {item.itemType === 'weapon' ? (
        <>
          <div className="role-library-wide-box">
            <span>伤害公式</span>
            <strong>{formatItemFormula(item)}</strong>
          </div>
          <div className="role-library-pill-row">
            <MetaPill tone="warning">{`预估伤害 ${item.damagePreview ?? '--'}`}</MetaPill>
            <MetaPill>{`最大耐久 ${item.weaponConfig?.maxDurability || '--'}`}</MetaPill>
          </div>
        </>
      ) : null}

      {item.itemType === 'equipment' ? (
        <>
          <div className="role-library-block">
            <div className="role-library-block-title">基础加成</div>
            <LibraryPillRow
              items={item.equipmentConfig?.modifiers || []}
              formatter={formatModifierLabel}
              emptyText="暂无基础加成"
            />
          </div>
          <div className="role-library-block">
            <div className="role-library-block-title">词条候选</div>
            <AffixList affixes={item.equipmentConfig?.bonusAffixes || []} emptyText="暂无额外词条" />
          </div>
        </>
      ) : null}
    </article>
  );
}

function WarehouseEntryCard({ entry }) {
  if (entry.entryType === 'skill_card') {
    return (
      <article className="role-library-card role-warehouse-card tone-skill">
        <div className="role-library-card-top">
          <div>
            <h3>{entry.displayName}</h3>
            <p>{entry.description || '暂无技能说明'}</p>
          </div>
          <div className="role-library-tag-group">
            <MetaPill tone="purple">技能卡</MetaPill>
          </div>
        </div>

        <div className="role-library-metric-grid">
          <MetricBox label="数量" value={entry.quantity ?? 0} />
          <MetricBox label="效果" value={`使用技能：${entry.displayName}`} />
        </div>

        {entry.skill?.requirements?.length ? (
          <div className="role-library-block">
            <div className="role-library-block-title">使用要求</div>
            <div className="role-library-pill-row">
              {entry.skill.requirements.map((item) => (
                <MetaPill key={`${entry.uuid}-${item.abilityKey}`} tone={item.met ? 'success' : 'muted'}>
                  {formatSkillRequirement(item)}
                </MetaPill>
              ))}
            </div>
          </div>
        ) : null}
      </article>
    );
  }

  const item = entry.item;

  return (
    <article className={`role-library-card role-warehouse-card tone-${getItemCardTone(item?.itemType)}`}>
      <div className="role-library-card-top">
        <div>
          <h3>{entry.displayName}</h3>
          <p>{entry.description || '暂无物品描述'}</p>
        </div>
        <div className="role-library-tag-group">
          <MetaPill>{getItemTypeLabel(item?.itemType)}</MetaPill>
          {item?.itemType === 'equipment' ? (
            <MetaPill tone="success">{getEquipmentSlotLabel(item?.itemSubType)}</MetaPill>
          ) : null}
          {entry.isEquipped ? <MetaPill tone="warning">已装备</MetaPill> : null}
        </div>
      </div>

      <div className="role-library-metric-grid">
        <MetricBox label="数量" value={entry.quantity ?? 0} />
        <MetricBox label="效果" value={item?.effectLabel || '--'} />
      </div>

      {item?.itemType === 'consumable' ? (
        <div className="role-library-block">
          <div className="role-library-block-title">{`剩余次数 ${entry.remainingUses ?? item.consumableConfig?.maxUses ?? '--'}`}</div>
          <LibraryPillRow
            items={item.consumableConfig?.effects || []}
            formatter={formatConsumableEffectLabel}
            emptyText="暂无效果配置"
            tone="info"
          />
        </div>
      ) : null}

      {item?.itemType === 'weapon' ? (
        <>
          <div className="role-library-metric-grid">
            <MetricBox label="当前耐久" value={`${entry.durabilityCurrent ?? '--'}/${entry.durabilityMax ?? '--'}`} />
            <MetricBox label="损坏概率" value={entry.breakRisk !== null ? `${entry.breakRisk}%` : '--'} />
          </div>
          <div className="role-library-wide-box">
            <span>伤害公式</span>
            <strong>{formatItemFormula(item)}</strong>
          </div>
        </>
      ) : null}

      {item?.itemType === 'equipment' ? (
        <>
          <div className="role-library-block">
            <div className="role-library-block-title">基础加成</div>
            <LibraryPillRow
              items={item.equipmentConfig?.modifiers || []}
              formatter={formatModifierLabel}
              emptyText="暂无基础加成"
            />
          </div>
          <div className="role-library-block">
            <div className="role-library-block-title">词条</div>
            {entry.entryAffixes?.length ? (
              <div className="role-library-pill-row">
                {entry.entryAffixes.map((affix, index) => (
                  <MetaPill key={`${entry.uuid}-affix-${index}`} tone="muted">
                    {`${affix.name}${affix.modifiers?.length ? `：${affix.modifiers.map(formatModifierLabel).join(' / ')}` : ''}`}
                  </MetaPill>
                ))}
              </div>
            ) : (
              <EmptyTag text="暂无额外词条" />
            )}
          </div>
        </>
      ) : null}
    </article>
  );
}

export function MePage() {
  const navigate = useNavigate();
  const cachedRoleResponse = getCachedRoleProfile();
  const cachedUserDetail = getCachedUserDetail();
  const cachedSkills = getCachedSkillList();
  const cachedItems = getCachedItemList();
  const cachedWarehouseProfile = getCachedWarehouseProfile();

  const [loading, setLoading] = useState(!(cachedRoleResponse && cachedUserDetail));
  const [detail, setDetail] = useState(cachedUserDetail);
  const [role, setRole] = useState(cachedRoleResponse?.role || null);
  const [activeTab, setActiveTab] = useState('attributes');
  const [skills, setSkills] = useState(cachedSkills || []);
  const [items, setItems] = useState(cachedItems || []);
  const [warehouseProfile, setWarehouseProfile] = useState(cachedWarehouseProfile || null);
  const [skillsStatus, setSkillsStatus] = useState(cachedSkills ? 'ready' : 'loading');
  const [itemsStatus, setItemsStatus] = useState(cachedItems ? 'ready' : 'loading');
  const [warehouseStatus, setWarehouseStatus] = useState(cachedWarehouseProfile ? 'ready' : 'loading');
  const [expandingWarehouse, setExpandingWarehouse] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    if (!role) {
      return undefined;
    }

    async function preloadPanels() {
      if (!cachedSkills) {
        try {
          const nextSkills = await ensureSkillList();
          if (!cancelled) {
            setSkills(nextSkills);
            setSkillsStatus('ready');
          }
        } catch (error) {
          console.error(error);
          if (!cancelled) {
            setSkillsStatus('error');
          }
        }
      }

      if (!cachedItems) {
        try {
          const nextItems = await ensureItemList();
          if (!cancelled) {
            setItems(nextItems);
            setItemsStatus('ready');
          }
        } catch (error) {
          console.error(error);
          if (!cancelled) {
            setItemsStatus('error');
          }
        }
      }

      if (!cachedWarehouseProfile) {
        try {
          const nextProfile = await ensureWarehouseProfile();
          if (!cancelled) {
            setWarehouseProfile(nextProfile);
            setWarehouseStatus('ready');
          }
        } catch (error) {
          console.error(error);
          if (!cancelled) {
            setWarehouseStatus('error');
          }
        }
      }
    }

    preloadPanels();

    return () => {
      cancelled = true;
    };
  }, [cachedItems, cachedSkills, cachedWarehouseProfile, role]);

  const derivedStats = useMemo(
    () => (role?.derived ? role.derived : computeRoleDerivedStats(role || {})),
    [role],
  );
  const abilityMap = useMemo(
    () => new Map((role?.abilities || []).map((item) => [item.abilityKey, item])),
    [role],
  );
  const attributeTotal = useMemo(() => computeRoleAttributeTotal(role || {}), [role]);
  const skillSummary = useMemo(() => summarizeSkillList(skills), [skills]);
  const itemSummary = useMemo(() => summarizeItemCatalog(items), [items]);
  const warehouseSummary = useMemo(() => summarizeWarehouse(warehouseProfile), [warehouseProfile]);
  const counts = {
    play: detail?.play?.length || 0,
    worlds: role?.worlds?.length || 0,
    items: role?.items?.length || 0,
  };

  const derivedCards = [
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
  ];

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

  const handleExpandWarehouse = async () => {
    try {
      setExpandingWarehouse(true);
      const response = await API.WAREHOUSE_EXPAND({ amount: 10 });
      if (response?.result !== 0) {
        message.error(response?.message || '仓库扩充失败');
        return;
      }

      commitWarehouseProfile(response.profile);
      setWarehouseProfile(response.profile);
      setWarehouseStatus('ready');
      message.success('仓库已扩充 10 格');
    } catch (error) {
      console.error(error);
      message.error('仓库扩充失败');
    } finally {
      setExpandingWarehouse(false);
    }
  };

  const renderLibraryTabs = () => (
    <>
      {primaryTabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`${activeTab === tab.key ? 'active' : ''} tone-${tab.tone}`}
          onClick={() => setActiveTab(tab.key)}
        >
          {tab.label}
        </button>
      ))}
      <span className="role-tab-divider" />
      {libraryTabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`${activeTab === tab.key ? 'active' : ''} tone-${tab.tone}`}
          onClick={() => setActiveTab(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </>
  );

  const renderAttributesPanel = () => (
    <section>
      <PanelSectionHeader title="九维属性" meta={`合计 ${attributeTotal}`} />
      <div className="role-attribute-grid">
        {roleAttributeDefinitions.map((item, index) => (
          <AttributeCard
            key={item.key}
            item={item}
            value={role.attributes?.[item.key] ?? 0}
            color={attributeColors[index % attributeColors.length]}
          />
        ))}
      </div>
      <h3 className="role-subsection-title">派生数值</h3>
      <div className="role-derived-grid">
        {derivedCards.map(([label, value]) => (
          <StatTile key={label} label={label} value={value} />
        ))}
      </div>
    </section>
  );

  const renderAbilitiesPanel = () => (
    <section>
      <PanelSectionHeader title="能力树" meta="当前角色实时成长" />
      <div className="role-ability-grid">
        {roleAbilityDefinitions.map((item) => (
          <AbilityCard
            key={item.key}
            item={item}
            current={abilityMap.get(item.key) || { level: 0, experience: 0 }}
          />
        ))}
      </div>
    </section>
  );

  const renderRecordsPanel = () => (
    <section>
      <PanelSectionHeader title="角色记录" meta="成长轨迹与收集记录" />
      <div className="role-record-list">
        <RecordGroup title="获得物品">
          {role.items?.length ? role.items.map((item) => <Chip key={item}>{item}</Chip>) : <EmptyTag text="暂无物品记录" />}
        </RecordGroup>
        <RecordGroup title="经历世界">
          {role.worlds?.length ? role.worlds.map((item) => <Chip key={item} tone="green">{item}</Chip>) : <EmptyTag text="暂无世界记录" />}
        </RecordGroup>
      </div>
    </section>
  );

  const renderSkillsPanel = () => {
    if (skillsStatus === 'loading') {
      return (
        <section className="role-library-panel">
          <PanelSectionHeader title="技能库" meta="正在同步技能数据" />
          <div className="role-library-scroll">
            <ContentPlaceholder loading text="技能库加载中" />
          </div>
        </section>
      );
    }

    if (skillsStatus === 'error') {
      return (
        <section className="role-library-panel">
          <PanelSectionHeader title="技能库" meta="加载失败" />
          <div className="role-library-scroll">
            <ContentPlaceholder text="技能库加载失败，请稍后重试" />
          </div>
        </section>
      );
    }

    return (
      <section className="role-library-panel">
        <PanelSectionHeader title="技能库" meta={`已达成 ${skillSummary.availableCount}/${skillSummary.total}`} />
        <div className="role-library-scroll">
          <div className="role-library-grid">
            {skills.map((skill) => (
              <SkillLibraryCard key={skill.uuid} skill={skill} />
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderEquipmentPanel = () => {
    if (itemsStatus === 'loading') {
      return (
        <section className="role-library-panel">
          <PanelSectionHeader title="装备库" meta="正在同步物品数据" />
          <div className="role-library-scroll">
            <ContentPlaceholder loading text="装备库加载中" />
          </div>
        </section>
      );
    }

    if (itemsStatus === 'error') {
      return (
        <section className="role-library-panel">
          <PanelSectionHeader title="装备库" meta="加载失败" />
          <div className="role-library-scroll">
            <ContentPlaceholder text="装备库加载失败，请稍后重试" />
          </div>
        </section>
      );
    }

    return (
      <section className="role-library-panel">
        <PanelSectionHeader
          title="装备库"
          meta={`共 ${itemSummary.total} 件 · 武器 ${itemSummary.weapons} · 装备 ${itemSummary.equipments} · 消耗品 ${itemSummary.consumables}`}
        />
        <div className="role-library-scroll">
          <div className="role-library-grid">
            {items.map((item) => (
              <EquipmentLibraryCard key={item.uuid} item={item} />
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderWarehousePanel = () => {
    if (warehouseStatus === 'loading') {
      return (
        <section className="role-library-panel">
          <PanelSectionHeader title="仓库" meta="正在同步仓库数据" />
          <div className="role-library-scroll">
            <ContentPlaceholder loading text="仓库加载中" />
          </div>
        </section>
      );
    }

    if (warehouseStatus === 'error') {
      return (
        <section className="role-library-panel">
          <PanelSectionHeader title="仓库" meta="加载失败" />
          <div className="role-library-scroll">
            <ContentPlaceholder text="仓库加载失败，请稍后重试" />
          </div>
        </section>
      );
    }

    return (
      <section className="role-library-panel">
        <PanelSectionHeader
          title="仓库"
          meta={`${warehouseSummary.usedSlots}/${warehouseSummary.capacity} 已用`}
          actions={(
            <button
              type="button"
              className="role-inline-action"
              onClick={handleExpandWarehouse}
              disabled={expandingWarehouse}
            >
              {expandingWarehouse ? '扩充中...' : '扩充 10 格'}
            </button>
          )}
        />
        <div className="role-library-scroll">
          <div className="role-library-grid">
            {(warehouseProfile?.entries || []).map((entry) => (
              <WarehouseEntryCard key={entry.uuid} entry={entry} />
            ))}
          </div>
        </div>
      </section>
    );
  };

  const renderActivePanel = () => {
    if (activeTab === 'attributes') {
      return renderAttributesPanel();
    }

    if (activeTab === 'abilities') {
      return renderAbilitiesPanel();
    }

    if (activeTab === 'records') {
      return renderRecordsPanel();
    }

    if (activeTab === 'skills') {
      return renderSkillsPanel();
    }

    if (activeTab === 'equipment') {
      return renderEquipmentPanel();
    }

    return renderWarehousePanel();
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
    <div className="role-dashboard-page" style={{ backgroundImage: `url(${images.background5})` }}>
      <img alt="logo" className="role-dashboard-logo" src={images.logo} />

      <div className="role-dashboard-shell">
        <aside className="role-sidebar">
          <section className="role-profile-card">
            <SideCardTitle>角色档案</SideCardTitle>
            <div className="role-profile-head">
              <div className="role-avatar-wrap">
                <img alt="avatar" src={images.avater} />
                <i />
              </div>
              <div className="role-profile-title">
                <h1>{role.name}</h1>
                <p>{`${getDisplayGender(role.gender)} · ${role.age}岁`}</p>
                <div>
                  <Chip>{`经验 ${role.experience || 0}`}</Chip>
                  <Chip>{`总值 ${attributeTotal}`}</Chip>
                </div>
              </div>
            </div>
            <p className="role-intro">{role.appearanceStyle || '暂未填写外观样式'}</p>
          </section>

          <section className="role-side-card">
            <SideCardTitle>战斗状态</SideCardTitle>
            <div className="role-status-grid">
              <StatTile label="生命 HP" value={derivedStats.maxHp} />
              <StatTile label="魔法 MP" value={derivedStats.maxMp} />
            </div>
          </section>

          <section className="role-side-card role-adventure-card">
            <SideCardTitle>冒险统计</SideCardTitle>
            <div className="role-adventure-grid">
              <StatTile label="剧本数" value={counts.play} />
              <StatTile label="经历世界" value={counts.worlds} />
              <StatTile label="获得物品" value={counts.items} />
            </div>
          </section>

          <section className="role-side-card role-action-card">
            <SideCardTitle>操作</SideCardTitle>
            <div className="role-action-stack">
              <ActionButton
                label={`${shortcutTabs[0].label}`}
                onClick={() => setActiveTab(shortcutTabs[0].key)}
                active={activeTab === shortcutTabs[0].key}
                wide
              />
              <div className="role-action-row">
                {shortcutTabs.slice(1).map((tab) => (
                  <ActionButton
                    key={tab.key}
                    label={tab.label}
                    onClick={() => setActiveTab(tab.key)}
                    active={activeTab === tab.key}
                  />
                ))}
              </div>
              <ActionButton label="重生" onClick={resetRole} danger wide />
            </div>
          </section>
        </aside>

        <main className="role-main-panel">
          <header className="role-main-header">
            <nav className="role-tab-list">
              {renderLibraryTabs()}
            </nav>
            <div className="role-header-actions">
              <button type="button" className="desktop-return-home-button role-account-link" onClick={() => navigate('/account')}>
                我的账号
              </button>
              <button type="button" className="desktop-return-home-button back" onClick={() => navigate('/main')}>
                返回主页
              </button>
            </div>
          </header>

          <div className={`role-main-content ${shortcutTabs.some((tab) => tab.key === activeTab) ? 'is-library-view' : ''}`}>
            {renderActivePanel()}
          </div>
        </main>
      </div>
    </div>
  );
}
