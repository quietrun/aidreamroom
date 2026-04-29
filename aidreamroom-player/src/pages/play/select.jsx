import { useEffect, useMemo, useState } from 'react';
import { Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import defaultPoster from '@/default_poster.png';
import loadingVideo from '@/loading.mp4';
import '../../styles/index.scss';
import { LoadingVideoOverlay } from '../../components/common/LoadingVideoOverlay';
import { HelpDialog } from '../../components/common/HelpDialog';
import { helpDialogConfig, images, firstLogin } from '../../constant';
import { getEquipmentSlotLabel, getItemTypeLabel } from '../../constant/item';
import { useLoadingVideoTransition } from '../../hooks/useLoadingVideoTransition';
import { API } from '../../utils/API';
import { ensureWarehouseProfile } from '../../utils/session';

const MAX_LOADOUT_SELECTION = 10;

const warehouseCategoryOptions = [
  {
    key: 'weapon',
    label: '武器',
    activeBackground: 'rgba(140, 59, 32, 0.28)',
    activeBorder: 'rgba(214, 111, 73, 0.52)',
  },
  {
    key: 'consumable',
    label: '消耗品',
    activeBackground: 'rgba(53, 65, 92, 0.28)',
    activeBorder: 'rgba(122, 145, 196, 0.48)',
  },
  {
    key: 'skill',
    label: '技能',
    activeBackground: 'rgba(93, 79, 168, 0.28)',
    activeBorder: 'rgba(155, 135, 226, 0.52)',
  },
];

const shellStyle = {
  backgroundColor: 'rgba(20, 24, 28, 0.82)',
  backgroundImage: 'none',
  width: 'fit-content',
  maxWidth: 'calc(100vw - 2rem)',
  height: '61rem',
  zoom: '90%',
  padding: '1.4rem',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
};

const panelStyle = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '1.15rem',
  color: '#fff',
};

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.36rem 0.72rem',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  fontSize: '0.74rem',
  lineHeight: 1.4,
};

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

function getEquipmentSlotKey(entry) {
  return entry?.item?.itemSubType || entry?.equippedSlot || '';
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

function getScriptThemeLabel(theme) {
  const tokens = getScriptThemeTokens(theme);

  if (!tokens.length) {
    return '--';
  }

  return tokens[0];
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

function SectionTitle({ title, extra = null }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '0.9rem',
      }}
    >
      <div style={{ fontSize: '1rem', fontWeight: 600, letterSpacing: '0.02em' }}>
        {title}
      </div>
      {extra}
    </div>
  );
}

function MetricCard({ label, value, accent }) {
  return (
    <div
      style={{
        padding: '0.85rem',
        borderRadius: '0.9rem',
        background: accent,
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div style={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.74rem', textAlign: 'left' }}>
        {label}
      </div>
      <div style={{ color: '#fff', fontSize: '1.1rem', textAlign: 'left', marginTop: '0.35rem' }}>
        {value}
      </div>
    </div>
  );
}

function SelectionChip({ label, accent = 'rgba(255,255,255,0.08)' }) {
  return <div style={{ ...chipStyle, background: accent }}>{label}</div>;
}

function PosterPill({ label, tone = 'wine' }) {
  const styleByTone = {
    wine: {
      background: 'linear-gradient(180deg, rgba(126, 24, 24, 0.88), rgba(88, 17, 17, 0.82))',
      border: '1px solid rgba(214, 73, 73, 0.4)',
    },
    amber: {
      background: 'linear-gradient(180deg, rgba(88, 55, 14, 0.88), rgba(66, 41, 10, 0.82))',
      border: '1px solid rgba(220, 161, 70, 0.42)',
    },
    blue: {
      background: 'linear-gradient(180deg, rgba(19, 47, 97, 0.88), rgba(17, 39, 80, 0.82))',
      border: '1px solid rgba(104, 146, 230, 0.38)',
    },
  };

  return (
    <div
      style={{
        width: 'fit-content',
        minWidth: '4.9rem',
        padding: '0.52rem 0.92rem',
        borderRadius: '999px',
        color: '#fff3d0',
        fontSize: '0.76rem',
        fontWeight: 600,
        lineHeight: 1.2,
        boxShadow: '0 0.6rem 1.2rem rgba(0,0,0,0.18)',
        ...styleByTone[tone],
      }}
    >
      {label}
    </div>
  );
}

function ScriptPosterMetric({ label, value }) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: '0.9rem 0.8rem',
        borderRadius: '1.05rem',
        border: '1px solid rgba(255, 223, 140, 0.12)',
        background: 'rgba(6, 6, 6, 0.54)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
      }}
    >
      <div
        style={{
          color: 'rgba(242, 225, 181, 0.68)',
          fontSize: '0.72rem',
          textAlign: 'center',
          marginBottom: '0.42rem',
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: '#f5dd96',
          fontSize: '1.18rem',
          fontWeight: 700,
          textAlign: 'center',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value || '--'}
      </div>
    </div>
  );
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

function getWarehouseCategoryKey(entry) {
  if (entry.entryType === 'skill_card') {
    return 'skill';
  }

  return entry.item?.itemType || 'other';
}

function CategoryTabs({ options, value, counts, onChange }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        gap: '0.5rem',
        marginBottom: '0.85rem',
      }}
    >
      {options.map((option) => {
        const active = option.key === value;

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            style={{
              height: '3.28rem',
              borderRadius: '1.72rem',
              border: active
                ? `1px solid ${option.activeBorder}`
                : '1px solid rgba(255,255,255,0.1)',
              background: active
                ? option.activeBackground
                : 'rgba(255,255,255,0.045)',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              whiteSpace: 'nowrap',
              boxShadow: active ? 'inset 0 0 0 1px rgba(255,255,255,0.035)' : 'none',
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>{option.label}</span>
            <span style={{ color: 'rgba(255,255,255,0.62)', fontVariantNumeric: 'tabular-nums', fontSize: '1.2rem' }}>
              {counts[option.key] || 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SelectionCard({
  title,
  subtitle,
  description,
  selected,
  onClick,
  disabled = false,
  accent = 'rgba(53, 65, 92, 0.28)',
  tags = [],
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        ...panelStyle,
        padding: '0.95rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        background: selected
          ? 'linear-gradient(180deg, rgba(28,122,59,0.42), rgba(28,122,59,0.22))'
          : accent,
        border: selected
          ? '1px solid rgba(111, 221, 143, 0.68)'
          : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '0.8rem',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontSize: '0.94rem', textAlign: 'left' }}>
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.72rem',
                textAlign: 'left',
                marginTop: '0.25rem',
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        <div
          style={{
            ...chipStyle,
            background: selected ? 'rgba(101, 215, 133, 0.18)' : 'rgba(255,255,255,0.08)',
            fontSize: '0.7rem',
          }}
        >
          {selected ? '已选择' : '可选择'}
        </div>
      </div>

      {description ? (
        <div
          style={{
            color: 'rgba(255,255,255,0.74)',
            fontSize: '0.76rem',
            lineHeight: 1.65,
            textAlign: 'left',
            marginTop: '0.68rem',
          }}
        >
          {description}
        </div>
      ) : null}

      {tags.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.7rem' }}>
          {tags.map((tag) => (
            <SelectionChip key={`${title}-${tag}`} label={tag} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PlaySelectPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [script, setScript] = useState(null);
  const [warehouseProfile, setWarehouseProfile] = useState(null);
  const [showHelp, setShowHelp] = useState(
    firstLogin && helpDialogConfig.help_play_change_character.flag,
  );
  const [warehouseCategory, setWarehouseCategory] = useState('weapon');
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
  } = useLoadingVideoTransition(loadingVideo);

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
          message.error('页面加载失败');
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
    () =>
      selectedLoadoutKeys
        .map((key) => selectionLookup.get(key))
        .filter(Boolean),
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
      navigate(`/play/main/${response.info.uuid}`, { replace: true });
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

  if (loading) {
    return (
      <div
        className="main-container"
        style={{
          background: `url(${images.background3})`,
          backgroundPosition: 'center center',
          backgroundSize: 'cover',
        }}
      >
        <img alt="logo" src={images.logo} className="login-logo" />
        <div
          className="mainpage-container"
          style={{ ...shellStyle, width: '26rem', height: '15rem', justifyContent: 'center' }}
        >
          <Spin />
        </div>
        <img alt="eng-logo" src={images.eng_logo} className="login-eng-logo" />
      </div>
    );
  }

  return (
    <>
      <div
        className="main-container"
        style={{
          background: `url(${images.background3})`,
          backgroundPosition: 'center center',
          backgroundSize: 'cover',
        }}
      >
        <img alt="logo" src={images.logo} className="login-logo" />

        <div className="mainpage-container" style={shellStyle}>
          <div className="normal-row" style={{ marginBottom: '1rem' }}>
            <div className="row">
              <img alt="back" src={images.icon_back} onClick={() => navigate(-1)} title="返回" />
              <span style={{ fontSize: '1.45rem' }}>入梦配置</span>
            </div>
            <div className="row" style={{ gap: '0.7rem' }}>
              <img
                alt="question"
                src={images.question}
                title="产品帮助"
                onClick={() => setShowHelp(true)}
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 30.8rem)',
              gap: '1rem',
              flex: 1,
              minHeight: 0,
            }}
          >
            <div style={{ minHeight: 0, paddingRight: '0.2rem' }}>
              <div
                style={{
                  position: 'relative',
                  minHeight: '100%',
                  height: '100%',
                  borderRadius: '1.8rem',
                  overflow: 'hidden',
                  border: '1px solid rgba(223, 186, 95, 0.34)',
                  backgroundImage: `linear-gradient(180deg, rgba(12,11,9,0.14) 0%, rgba(12,11,9,0.36) 24%, rgba(12,11,9,0.72) 66%, rgba(8,8,7,0.94) 100%), url(${scriptPoster})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center center',
                  boxShadow: '0 1.2rem 2.8rem rgba(0,0,0,0.28)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '1.35rem',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(180deg, rgba(255,214,120,0.08), transparent 10%, transparent 82%, rgba(255,214,120,0.05))',
                    pointerEvents: 'none',
                  }}
                />

                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                    <PosterPill
                      label={script ? getScriptThemeLabel(script.metadata?.theme) : '随机剧本'}
                    />
                    <PosterPill
                      label={`难度：${script ? getScriptDifficultyLabel(script.metadata?.difficulty) : '--'}`}
                      tone="amber"
                    />
                    <PosterPill
                      label={script ? getScriptSizeLabel(script.metadata?.totalNodes) : '--'}
                      tone="blue"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={refreshRandomScript}
                    disabled={scriptLoading || starting}
                    style={{
                      width: '3.35rem',
                      height: '3.35rem',
                      borderRadius: '999px',
                      border: '1px solid rgba(223, 186, 95, 0.34)',
                      background: 'rgba(12, 12, 10, 0.48)',
                      color: '#eecf7a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: scriptLoading || starting ? 'not-allowed' : 'pointer',
                      opacity: scriptLoading || starting ? 0.66 : 1,
                      backdropFilter: 'blur(8px)',
                      boxShadow: '0 0.75rem 1.4rem rgba(0,0,0,0.18)',
                      fontSize: '1.34rem',
                    }}
                    title="换一个随机剧本"
                  >
                    {scriptLoading ? <Spin size="small" /> : '↻'}
                  </button>
                </div>

                <div style={{ flex: 1 }} />

                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                    {scriptFeatureTags.map((tag) => (
                      <div
                        key={tag}
                        style={{
                          padding: '0.36rem 0.72rem',
                          borderRadius: '999px',
                          border: '1px solid rgba(233, 196, 94, 0.2)',
                          background: 'rgba(48, 39, 13, 0.58)',
                          color: '#f1d789',
                          fontSize: '0.74rem',
                          lineHeight: 1.2,
                        }}
                      >
                        {tag}
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      color: '#fffaf0',
                      fontSize: '2.15rem',
                      fontWeight: 700,
                      textAlign: 'left',
                      lineHeight: 1.18,
                      textShadow: '0 0.35rem 1.1rem rgba(0,0,0,0.32)',
                    }}
                  >
                    {script?.metadata?.title || '当前没有可展示的随机剧本'}
                  </div>

                  <div
                    style={{
                      color: 'rgba(244, 232, 204, 0.82)',
                      fontSize: '0.92rem',
                      lineHeight: 1.85,
                      textAlign: 'left',
                      textShadow: '0 0.2rem 0.85rem rgba(0,0,0,0.24)',
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      minHeight: '6.9rem',
                    }}
                  >
                    {script?.metadata?.description || '请刷新剧本池后再次尝试。'}
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: '0.75rem',
                    }}
                  >
                    <ScriptPosterMetric
                      label="主题"
                      value={script ? getScriptThemeLabel(script.metadata?.theme) : '--'}
                    />
                    <ScriptPosterMetric
                      label="规模"
                      value={script ? getScriptSizeLabel(script.metadata?.totalNodes) : '--'}
                    />
                    <ScriptPosterMetric
                      label="叙事"
                      value={script ? getScriptNarrativeLabel(script) : '--'}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleStart}
                    disabled={!script?.uuid || starting}
                    style={{
                      height: '4.2rem',
                      borderRadius: '1.35rem',
                      border: '1px solid rgba(233, 196, 94, 0.38)',
                      background:
                        starting
                          ? 'linear-gradient(135deg, rgba(112, 91, 32, 0.92), rgba(91, 71, 23, 0.92))'
                          : 'linear-gradient(135deg, rgba(123, 100, 36, 0.9), rgba(96, 74, 22, 0.9))',
                      color: '#f9e2a2',
                      fontSize: '1.42rem',
                      fontWeight: 700,
                      cursor: !script?.uuid || starting ? 'not-allowed' : 'pointer',
                      opacity: !script?.uuid || starting ? 0.72 : 1,
                      boxShadow: '0 1rem 2rem rgba(0,0,0,0.2)',
                    }}
                  >
                    {starting ? '梦境载入中...' : '✦ 入梦启程'}
                  </button>
                </div>
              </div>
            </div>

            <div
              style={{
                minHeight: 0,
                height: '100%',
                paddingRight: '0.2rem',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div style={{ ...panelStyle, padding: '1.1rem', marginBottom: '1rem', flexShrink: 0 }}>
                <SectionTitle title="当前配置" />
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '0.65rem',
                  }}
                >
                  <MetricCard
                    label="仓库内容"
                    value={`${selectedLoadoutList.length}/${MAX_LOADOUT_SELECTION}`}
                    accent="rgba(28, 122, 59, 0.28)"
                  />
                  <MetricCard
                    label="已选装备"
                    value={selectedEquipmentList.length}
                    accent="rgba(148, 91, 39, 0.28)"
                  />
                  <MetricCard
                    label="总配置数"
                    value={selectedEquipmentList.length + selectedLoadoutList.length}
                    accent="rgba(53, 65, 92, 0.28)"
                  />
                </div>

                <div style={{ marginTop: '0.95rem' }}>
                  <div
                    style={{
                      color: '#fff',
                      fontSize: '0.82rem',
                      textAlign: 'left',
                      marginBottom: '0.55rem',
                    }}
                  >
                    将被带入开局的内容
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                    {selectedEquipmentList.map((entry) => (
                      <SelectionChip
                        key={`selected-equipment-${entry.uuid}`}
                        label={buildEquipmentSelectionLabel(entry)}
                        accent="rgba(148, 91, 39, 0.28)"
                      />
                    ))}
                    {selectedLoadoutList.map((item) => (
                      <SelectionChip
                        key={`selected-loadout-${item.source}-${item.entry.uuid}`}
                        label={item.label}
                        accent={
                          item.entry?.entryType === 'skill_card'
                            ? 'rgba(93, 79, 168, 0.28)'
                            : 'rgba(53, 65, 92, 0.28)'
                        }
                      />
                    ))}
                    {!selectedEquipmentList.length && !selectedLoadoutList.length ? (
                      <SelectionChip label="尚未选择任何配置" />
                    ) : null}
                  </div>
                </div>
              </div>

              <div
                style={{
                  ...panelStyle,
                  padding: '1.1rem',
                  flex: 1,
                  minHeight: 0,
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <SectionTitle
                    title="身上装备"
                    extra={
                      <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: '0.76rem' }}>
                        不占用 10 个仓库位
                      </div>
                    }
                  />
                </div>
                {equippedEntries.length ? (
                  <div
                    style={{
                      display: 'grid',
                      gap: '0.8rem',
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      paddingRight: '0.2rem',
                    }}
                  >
                    {equippedEntries.map((entry) => (
                      <SelectionCard
                        key={entry.uuid}
                        title={entry.displayName}
                        subtitle={getEquipmentSlotLabel(entry.item?.itemSubType) || '装备'}
                        description={getEntryDisplayDescription(entry)}
                        selected={selectedEquipmentIds.includes(entry.uuid)}
                        onClick={() => toggleEquipment(entry)}
                        accent="rgba(25, 73, 51, 0.28)"
                        tags={[
                          getItemTypeLabel(entry.item?.itemType),
                          getEquipmentSlotLabel(entry.item?.itemSubType),
                          ...(entry.entryAffixes?.map((item) => item.name) || []).slice(0, 2),
                        ].filter(Boolean)}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      paddingRight: '0.2rem',
                      color: 'rgba(255,255,255,0.72)',
                      fontSize: '0.82rem',
                      textAlign: 'left',
                    }}
                  >
                    当前没有已装备的道具。
                  </div>
                )}
              </div>
            </div>

            <div style={{ minHeight: 0 }}>
              <div
                style={{
                  ...panelStyle,
                  padding: '1.1rem',
                  height: '100%',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <SectionTitle
                    title="仓库内容"
                    extra={
                      <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: '0.76rem' }}>
                        最多选择 10 项
                      </div>
                    }
                  />
                  <CategoryTabs
                    options={warehouseCategoryOptions}
                    value={warehouseCategory}
                    counts={warehouseCategoryCounts}
                    onChange={setWarehouseCategory}
                  />
                </div>

                {warehouseEntries.length ? (
                  <div
                    style={{
                      display: 'grid',
                      gap: '0.8rem',
                      flex: 1,
                      overflowY: 'auto',
                      minHeight: 0,
                      paddingRight: '0.2rem',
                    }}
                  >
                    {filteredWarehouseEntries.map((entry) => {
                      const key = buildWarehouseSelectionKey(entry);
                      const selected = selectedLoadoutKeys.includes(key);
                      const disabled =
                        !selected && selectedLoadoutKeys.length >= MAX_LOADOUT_SELECTION;

                      return (
                        <SelectionCard
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
                          accent={
                            entry.entryType === 'skill_card'
                              ? 'rgba(93, 79, 168, 0.28)'
                              : entry.item?.itemType === 'weapon'
                                ? 'rgba(140, 59, 32, 0.28)'
                                : entry.item?.itemType === 'equipment'
                                  ? 'rgba(25, 73, 51, 0.28)'
                                  : 'rgba(53, 65, 92, 0.28)'
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
                    {!filteredWarehouseEntries.length ? (
                      <div
                        style={{
                          color: 'rgba(255,255,255,0.72)',
                          fontSize: '0.82rem',
                          textAlign: 'left',
                        }}
                      >
                        当前分类暂无可配置内容。
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div
                    style={{
                      color: 'rgba(255,255,255,0.72)',
                      fontSize: '0.82rem',
                      textAlign: 'left',
                    }}
                  >
                    仓库中暂无可配置内容。
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        <img alt="eng-logo" src={images.eng_logo} className="login-eng-logo" />
      </div>

      <LoadingVideoOverlay
        src={loadingVideo}
        visible={transitionVisible}
        completed={transitionCompleted}
        videoRef={videoRef}
        onEnded={handleVideoEnded}
        onError={handleVideoError}
      />

      {showHelp ? (
        <HelpDialog
          id="help_play_change_character"
          onClose={() => setShowHelp(false)}
        />
      ) : null}
    </>
  );
}
