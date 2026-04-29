import { useEffect, useMemo, useState } from 'react';
import { Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import defaultPoster from '@/default_poster.png';
import mobileLoadingVideo from '@/mobile_loading.mp4';
import '../../styles/index.scss';
import { LoadingVideoOverlay } from '../../../components/common/LoadingVideoOverlay';
import { images } from '../../../constant';
import { getEquipmentSlotLabel, getItemTypeLabel } from '../../../constant/item';
import { useLoadingVideoTransition } from '../../../hooks/useLoadingVideoTransition';
import { API } from '../../../utils/API';
import { ensureWarehouseProfile } from '../../../utils/session';

const MAX_LOADOUT_SELECTION = 10;

const warehouseCategoryOptions = [
  { key: 'weapon', label: '武器' },
  { key: 'consumable', label: '消耗品' },
  { key: 'skill', label: '技能' },
];

const scriptThemeLabelMap = {
  horror: '惊悚',
  mystery: '悬疑',
  survival: '生存',
  fantasy: '奇幻',
  adventure: '冒险',
  romance: '恋爱',
  historical: '历史',
  wuxia: '武侠',
  xianxia: '仙侠',
  cyberpunk: '赛博朋克',
  scifi: '科幻',
  'sci-fi': '科幻',
  'science-fiction': '科幻',
  science_fiction: '科幻',
  coc: 'CoC规则',
  hospital_horror: '医院惊悚',
  supernatural_system: '系统异常',
  occult: '神秘学',
  investigation: '调查',
  urban_legend: '都市传闻',
};

function buildWarehouseSelectionKey(entry) {
  return `warehouse:${entry.uuid}`;
}

function buildWarehouseSelectionLabel(entry) {
  if (entry.entryType === 'skill_card') {
    return `技能卡:${entry.displayName}`;
  }

  if (entry.item?.itemType === 'equipment') {
    return `装备:${entry.displayName}`;
  }

  return `物品:${entry.displayName}`;
}

function buildEquipmentSelectionLabel(entry) {
  return `装备:${entry.displayName}`;
}

function sanitizePlayLabel(value) {
  return String(value || '').replaceAll(',', '，').trim();
}

function normalizeScriptToken(value) {
  return String(value || '').trim().toLowerCase().replaceAll(' ', '_');
}

function formatScriptThemeToken(value) {
  const normalized = normalizeScriptToken(value);
  return scriptThemeLabelMap[normalized] || String(value || '').trim();
}

function getScriptThemeTokens(theme) {
  return String(theme || '')
    .split('|')
    .map((token) => formatScriptThemeToken(token))
    .filter(Boolean);
}

function getScriptThemeLabel(theme) {
  const tokens = getScriptThemeTokens(theme);
  return tokens[0] || '--';
}

function getScriptDifficultyLabel(difficulty) {
  const rawDifficulty = String(difficulty || '').trim();

  if (!rawDifficulty) {
    return '--';
  }

  const difficultyLabelMap = {
    easy: '简单',
    normal: '普通',
    medium: '中等',
    hard: '困难',
    expert: '专家',
    nightmare: '噩梦',
    hell: '地狱',
  };

  return difficultyLabelMap[rawDifficulty.toLowerCase()] || rawDifficulty;
}

function getScriptSizeLabel(totalNodes) {
  const count = Number(totalNodes);

  if (!Number.isFinite(count) || count < 0) {
    return '未知';
  }
  if (count <= 30) {
    return '小型';
  }
  if (count <= 60) {
    return '中型';
  }
  if (count <= 90) {
    return '大型';
  }
  if (count <= 120) {
    return '超大型';
  }
  return '世界级';
}

function getScriptNarrativeLabel(script) {
  if (script?.metadata?.storyCore) {
    return '剧情驱动';
  }
  if ((script?.metadata?.requiredKnowledge || []).length) {
    return '调查叙事';
  }
  if ((script?.metadata?.requiredItems || []).length) {
    return '资源博弈';
  }
  return '沉浸叙事';
}

function getScriptFeatureTags(script) {
  const themeTokens = getScriptThemeTokens(script?.metadata?.theme).slice(1);

  if (themeTokens.length) {
    return themeTokens.slice(0, 4);
  }

  const fallback = [];
  if ((script?.metadata?.requiredKnowledge || []).length) {
    fallback.push('线索检定');
  }
  if ((script?.metadata?.requiredItems || []).length) {
    fallback.push('关键道具');
  }
  if (script?.metadata?.storyCore) {
    fallback.push('主线驱动');
  }
  fallback.push('沉浸叙事');

  return Array.from(new Set(fallback)).slice(0, 4);
}

function getScriptPoster(script) {
  return (
    script?.metadata?.poster ||
    script?.metadata?.cover ||
    script?.metadata?.image ||
    script?.poster ||
    defaultPoster
  );
}

function getEntryDisplayDescription(entry) {
  if (!entry) {
    return '暂无描述';
  }

  if (entry.entryType === 'skill_card') {
    return entry.description || '暂无描述';
  }

  if (entry.item?.itemType && entry.item.itemType !== 'consumable') {
    return entry.item?.effectLabel || entry.description || '暂无描述';
  }

  return entry.description || entry.item?.effectLabel || '暂无描述';
}

function getWarehouseCategoryKey(entry) {
  if (entry.entryType === 'skill_card') {
    return 'skill';
  }

  return entry.item?.itemType || 'other';
}

function getEquipmentSlotKey(entry) {
  return entry?.item?.itemSubType || entry?.equippedSlot || '';
}

function SelectMetric({ label, value, accent = false }) {
  return (
    <div className="mobile-play-select-v2__metric">
      <span>{label}</span>
      <strong className={accent ? 'is-accent' : ''}>{value}</strong>
    </div>
  );
}

function SelectChip({ label, accent = 'default' }) {
  return <span className={`mobile-play-select-v2__chip is-${accent}`}>{label}</span>;
}

function SelectTab({ label, badge, active, onClick }) {
  return (
    <button
      type="button"
      className={`mobile-play-select-v2__tab${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <span>{label}</span>
      <em>{badge}</em>
    </button>
  );
}

function EntryCard({
  title,
  subtitle,
  description,
  tags = [],
  selected = false,
  disabled = false,
  tone = 'blue',
  onClick,
}) {
  return (
    <button
      type="button"
      className={`mobile-play-select-v2__entrycard tone-${tone}${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <div className="mobile-play-select-v2__entryhead">
        <div>
          <strong>{title}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
        <i>{selected ? '已选择' : '可选择'}</i>
      </div>
      {description ? <p>{description}</p> : null}
      {tags.length ? (
        <div className="mobile-play-select-v2__chiplist">
          {tags.map((tag) => (
            <SelectChip key={`${title}-${tag}`} label={tag} />
          ))}
        </div>
      ) : null}
    </button>
  );
}

export function MobilePlaySelectPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [script, setScript] = useState(null);
  const [warehouseProfile, setWarehouseProfile] = useState(null);
  const [warehouseCategory, setWarehouseCategory] = useState('weapon');
  const [activeTab, setActiveTab] = useState('script');
  const [selectedLoadoutKeys, setSelectedLoadoutKeys] = useState([]);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState([]);
  const {
    videoRef,
    transitionVisible,
    transitionCompleted,
    startTransition,
    cancelTransition,
    handleVideoEnded,
    handleVideoError,
  } = useLoadingVideoTransition(mobileLoadingVideo);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [scriptResponse, nextWarehouseProfile] = await Promise.all([
          API.SCRIPT_RANDOM(),
          ensureWarehouseProfile(),
        ]);

        if (!mounted) {
          return;
        }

        if (scriptResponse?.result === 0 && scriptResponse.script) {
          setScript(scriptResponse.script);
        }

        setWarehouseProfile(nextWarehouseProfile || null);

        const equippedIds = (nextWarehouseProfile?.entries || [])
          .filter(
            (entry) =>
              entry.entryType === 'item' &&
              entry.item?.itemType === 'equipment' &&
              entry.isEquipped,
          )
          .map((entry) => entry.uuid);

        setSelectedEquipmentIds(equippedIds);
      } catch (error) {
        console.error(error);
        if (mounted) {
          message.error('入梦配置加载失败');
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
  }, []);

  const refreshRandomScript = async () => {
    try {
      setScriptLoading(true);
      const response = await API.SCRIPT_RANDOM();
      if (response?.result !== 0 || !response.script) {
        setScript(null);
        message.info(response?.message || '暂无可用剧本');
        return;
      }

      setScript(response.script);
    } catch (error) {
      console.error(error);
      message.error('随机剧本加载失败');
    } finally {
      setScriptLoading(false);
    }
  };

  const equippedEntries = useMemo(
    () =>
      (warehouseProfile?.entries || []).filter(
        (entry) =>
          entry.entryType === 'item' &&
          entry.item?.itemType === 'equipment' &&
          entry.isEquipped,
      ),
    [warehouseProfile],
  );

  const warehouseEntries = useMemo(
    () =>
      (warehouseProfile?.entries || []).filter(
        (entry) =>
          !equippedEntries.some((equippedEntry) => equippedEntry.uuid === entry.uuid),
      ),
    [warehouseProfile, equippedEntries],
  );

  const warehouseCategoryCounts = useMemo(
    () =>
      warehouseEntries.reduce(
        (counts, entry) => {
          const categoryKey = getWarehouseCategoryKey(entry);
          if (Object.prototype.hasOwnProperty.call(counts, categoryKey)) {
            counts[categoryKey] += 1;
          }
          return counts;
        },
        { weapon: 0, consumable: 0, skill: 0 },
      ),
    [warehouseEntries],
  );

  const filteredWarehouseEntries = useMemo(
    () => warehouseEntries.filter((entry) => getWarehouseCategoryKey(entry) === warehouseCategory),
    [warehouseCategory, warehouseEntries],
  );

  const selectionLookup = useMemo(() => {
    const map = new Map();

    warehouseEntries.forEach((entry) => {
      map.set(buildWarehouseSelectionKey(entry), {
        source: 'warehouse',
        label: buildWarehouseSelectionLabel(entry),
        entry,
      });
    });

    return map;
  }, [warehouseEntries]);

  const selectedLoadoutList = useMemo(
    () => selectedLoadoutKeys.map((key) => selectionLookup.get(key)).filter(Boolean),
    [selectedLoadoutKeys, selectionLookup],
  );

  const selectedEquipmentList = useMemo(
    () => equippedEntries.filter((entry) => selectedEquipmentIds.includes(entry.uuid)),
    [equippedEntries, selectedEquipmentIds],
  );

  useEffect(() => {
    setSelectedLoadoutKeys((current) =>
      current.filter((key) => selectionLookup.has(key)).slice(0, MAX_LOADOUT_SELECTION),
    );
  }, [selectionLookup]);

  useEffect(() => {
    const equippedMap = new Map(equippedEntries.map((entry) => [entry.uuid, entry]));
    setSelectedEquipmentIds((current) => {
      const next = [];
      const usedSlots = new Set();

      for (const id of current) {
        const entry = equippedMap.get(id);
        if (!entry) {
          continue;
        }

        const slotKey = getEquipmentSlotKey(entry) || id;
        if (usedSlots.has(slotKey)) {
          continue;
        }

        usedSlots.add(slotKey);
        next.push(id);
      }

      return next;
    });
  }, [equippedEntries]);

  const toggleLoadout = (key) => {
    setSelectedLoadoutKeys((current) => {
      if (current.includes(key)) {
        return current.filter((item) => item !== key);
      }

      if (current.length >= MAX_LOADOUT_SELECTION) {
        message.info(`仓库内容最多只能选择 ${MAX_LOADOUT_SELECTION} 项`);
        return current;
      }

      return [...current, key];
    });
  };

  const toggleEquipment = (entry) => {
    const entryId = entry.uuid;
    const slotKey = getEquipmentSlotKey(entry);

    setSelectedEquipmentIds((current) => {
      if (current.includes(entryId)) {
        return current.filter((id) => id !== entryId);
      }

      if (!slotKey) {
        return [...current, entryId];
      }

      const next = current.filter((id) => {
        const selectedEntry = equippedEntries.find((item) => item.uuid === id);
        return getEquipmentSlotKey(selectedEntry) !== slotKey;
      });

      return [...next, entryId];
    });
  };

  const handleStart = async () => {
    if (starting) {
      return;
    }

    if (!script?.uuid) {
      message.info('当前没有可用剧本');
      return;
    }

    const currentItems = Array.from(
      new Set(
        [
          ...selectedEquipmentList.map((entry) =>
            sanitizePlayLabel(buildEquipmentSelectionLabel(entry)),
          ),
          ...selectedLoadoutList.map((item) => sanitizePlayLabel(item.label)),
        ].filter(Boolean),
      ),
    );

    setStarting(true);
    const transitionPromise = startTransition();

    try {
      const response = await API.PLAY_CREATE({
        script_id: script.uuid,
        model_id: 1,
        currentItems,
      });

      if (response?.result !== 0 || !response?.info?.uuid) {
        cancelTransition();
        message.error(response?.message || '开始失败');
        return;
      }

      await transitionPromise;
      navigate(`/mobile/play/main/${response.info.uuid}`, { replace: true });
    } catch (error) {
      console.error(error);
      cancelTransition();
      message.error('开始失败');
    } finally {
      setStarting(false);
    }
  };

  const scriptFeatureTags = getScriptFeatureTags(script);
  const scriptPoster = getScriptPoster(script);
  const selectedTotal = selectedEquipmentList.length + selectedLoadoutList.length;

  if (loading) {
    return (
      <div className="mobile-app">
        <div className="main-container mobile-play-select-v2" style={{ backgroundImage: `url(${images.background3})` }}>
          <div className="mobile-play-select-v2__scroll" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
            <Spin />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mobile-app">
        <div className="main-container mobile-play-select-v2" style={{ backgroundImage: `url(${images.background3})` }}>
          <div className="mobile-play-select-v2__scroll">
            <header className="mobile-play-select-v2__header">
              <button type="button" className="mobile-play-select-v2__headerbutton" onClick={() => navigate(-1)}>
                {'< 返回'}
              </button>
              <div className="mobile-play-select-v2__headcopy">
                <span>AI Dreamroom</span>
                <strong>入梦配置</strong>
              </div>
              <button
                type="button"
                className="mobile-play-select-v2__headerbutton"
                onClick={refreshRandomScript}
                disabled={scriptLoading || starting}
              >
                {scriptLoading ? '刷新中' : '换剧本'}
              </button>
            </header>

            <section className="mobile-play-select-v2__summary">
              <SelectMetric label="当前剧本" value={script?.metadata?.title || '随机载入中'} />
              <SelectMetric label="已选装备" value={selectedEquipmentList.length} />
              <SelectMetric label="仓库携带" value={`${selectedLoadoutList.length}/${MAX_LOADOUT_SELECTION}`} />
              <SelectMetric label="总配置数" value={selectedTotal} accent />
            </section>

            <div className="mobile-play-select-v2__tabs">
              <SelectTab
                label="剧本"
                badge={script?.uuid ? getScriptThemeLabel(script.metadata?.theme) : '--'}
                active={activeTab === 'script'}
                onClick={() => setActiveTab('script')}
              />
              <SelectTab
                label="配置"
                badge={selectedTotal}
                active={activeTab === 'config'}
                onClick={() => setActiveTab('config')}
              />
              <SelectTab
                label="仓库"
                badge={warehouseEntries.length}
                active={activeTab === 'warehouse'}
                onClick={() => setActiveTab('warehouse')}
              />
            </div>

            {activeTab === 'script' ? (
              <section className="mobile-play-select-v2__panel">
                <div
                  className="mobile-play-select-v2__poster"
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(12,11,9,0.18) 0%, rgba(12,11,9,0.38) 28%, rgba(12,11,9,0.76) 72%, rgba(8,8,7,0.94) 100%), url(${scriptPoster})`,
                  }}
                >
                  <div className="mobile-play-select-v2__posterbadges">
                    <SelectChip label={script ? getScriptThemeLabel(script.metadata?.theme) : '随机剧本'} accent="amber" />
                    <SelectChip
                      label={`难度：${script ? getScriptDifficultyLabel(script.metadata?.difficulty) : '--'}`}
                      accent="wine"
                    />
                    <SelectChip
                      label={script ? getScriptSizeLabel(script.metadata?.totalNodes) : '--'}
                      accent="blue"
                    />
                  </div>

                  <div className="mobile-play-select-v2__posterfooter">
                    <div className="mobile-play-select-v2__chiplist">
                      {scriptFeatureTags.map((tag) => (
                        <SelectChip key={tag} label={tag} accent="gold" />
                      ))}
                    </div>
                    <h2>{script?.metadata?.title || '当前没有可展示的随机剧本'}</h2>
                    <p>{script?.metadata?.description || '请刷新剧本池后再次尝试。'}</p>
                    <div className="mobile-play-select-v2__posterstats">
                      <SelectMetric
                        label="主题"
                        value={script ? getScriptThemeLabel(script.metadata?.theme) : '--'}
                      />
                      <SelectMetric
                        label="规模"
                        value={script ? getScriptSizeLabel(script.metadata?.totalNodes) : '--'}
                      />
                      <SelectMetric
                        label="叙事"
                        value={script ? getScriptNarrativeLabel(script) : '--'}
                      />
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab === 'config' ? (
              <section className="mobile-play-select-v2__panel">
                <div className="mobile-play-select-v2__section">
                  <div className="mobile-play-select-v2__sectionhead">
                    <strong>当前配置</strong>
                    <span>将被带入开局的内容</span>
                  </div>
                  <div className="mobile-play-select-v2__chiplist">
                    {selectedEquipmentList.map((entry) => (
                      <SelectChip
                        key={`selected-equipment-${entry.uuid}`}
                        label={buildEquipmentSelectionLabel(entry)}
                        accent="green"
                      />
                    ))}
                    {selectedLoadoutList.map((item) => (
                      <SelectChip
                        key={`selected-loadout-${item.entry.uuid}`}
                        label={item.label}
                        accent={item.entry?.entryType === 'skill_card' ? 'violet' : 'blue'}
                      />
                    ))}
                    {!selectedEquipmentList.length && !selectedLoadoutList.length ? (
                      <SelectChip label="尚未选择任何配置" />
                    ) : null}
                  </div>
                </div>

                <div className="mobile-play-select-v2__section">
                  <div className="mobile-play-select-v2__sectionhead">
                    <strong>身上装备</strong>
                    <span>不占用 10 个仓库位</span>
                  </div>
                  {equippedEntries.length ? (
                    <div className="mobile-play-select-v2__entrylist">
                      {equippedEntries.map((entry) => (
                        <EntryCard
                          key={entry.uuid}
                          title={entry.displayName}
                          subtitle={getEquipmentSlotLabel(entry.item?.itemSubType) || '装备'}
                          description={getEntryDisplayDescription(entry)}
                          selected={selectedEquipmentIds.includes(entry.uuid)}
                          onClick={() => toggleEquipment(entry)}
                          tone="green"
                          tags={[
                            getItemTypeLabel(entry.item?.itemType),
                            getEquipmentSlotLabel(entry.item?.itemSubType),
                            ...(entry.entryAffixes?.map((item) => item.name) || []).slice(0, 2),
                          ].filter(Boolean)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mobile-play-select-v2__empty">当前没有已装备的道具。</div>
                  )}
                </div>
              </section>
            ) : null}

            {activeTab === 'warehouse' ? (
              <section className="mobile-play-select-v2__panel">
                <div className="mobile-play-select-v2__section">
                  <div className="mobile-play-select-v2__sectionhead">
                    <strong>仓库内容</strong>
                    <span>最多选择 10 项</span>
                  </div>

                  <div className="mobile-play-select-v2__categorytabs">
                    {warehouseCategoryOptions.map((option) => {
                      const active = warehouseCategory === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          className={`mobile-play-select-v2__categorytab${active ? ' is-active' : ''}`}
                          onClick={() => setWarehouseCategory(option.key)}
                        >
                          <span>{option.label}</span>
                          <em>{warehouseCategoryCounts[option.key] || 0}</em>
                        </button>
                      );
                    })}
                  </div>

                  {warehouseEntries.length ? (
                    filteredWarehouseEntries.length ? (
                      <div className="mobile-play-select-v2__entrylist">
                        {filteredWarehouseEntries.map((entry) => {
                          const key = buildWarehouseSelectionKey(entry);
                          const selected = selectedLoadoutKeys.includes(key);
                          const disabled =
                            !selected && selectedLoadoutKeys.length >= MAX_LOADOUT_SELECTION;

                          return (
                            <EntryCard
                              key={entry.uuid}
                              title={entry.displayName}
                              subtitle={
                                entry.entryType === 'skill_card'
                                  ? '技能卡'
                                  : entry.item?.itemType === 'equipment'
                                    ? getEquipmentSlotLabel(entry.item?.itemSubType) || '装备'
                                    : getItemTypeLabel(entry.item?.itemType) || '物品'
                              }
                              description={getEntryDisplayDescription(entry)}
                              selected={selected}
                              disabled={disabled}
                              onClick={() => toggleLoadout(key)}
                              tone={
                                entry.entryType === 'skill_card'
                                  ? 'violet'
                                  : entry.item?.itemType === 'weapon'
                                    ? 'wine'
                                    : 'blue'
                              }
                              tags={[
                                entry.entryType === 'skill_card'
                                  ? '技能卡'
                                  : getItemTypeLabel(entry.item?.itemType),
                                entry.item?.itemType === 'equipment'
                                  ? getEquipmentSlotLabel(entry.item?.itemSubType)
                                  : null,
                                `数量 ${entry.quantity}`,
                              ].filter(Boolean)}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mobile-play-select-v2__empty">当前分类暂无可配置内容。</div>
                    )
                  ) : (
                    <div className="mobile-play-select-v2__empty">仓库中暂无可配置内容。</div>
                  )}
                </div>
              </section>
            ) : null}

            <footer className="mobile-play-select-v2__footer">
              <button
                type="button"
                className="mobile-play-select-v2__startbutton"
                onClick={handleStart}
                disabled={!script?.uuid || starting}
              >
                {starting ? '梦境载入中...' : '✦ 入梦启程'}
              </button>
            </footer>
          </div>
        </div>
      </div>

      <LoadingVideoOverlay
        src={mobileLoadingVideo}
        visible={transitionVisible}
        completed={transitionCompleted}
        videoRef={videoRef}
        onEnded={handleVideoEnded}
        onError={handleVideoError}
        mobile
      />
    </>
  );
}
