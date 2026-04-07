import { useEffect, useMemo, useState } from 'react';
import { Input } from 'antd';
import { useNavigate } from 'react-router-dom';
import '../../styles/index.scss';
import { images } from '../../constant';
import { API } from '../../utils/API';
import { SortSelect } from '../../components/play/SortSelect';
import { DreamSelectionCard } from '../../components/play/DreamSelectionCard';
import { CharacterPreviewDialog, PlotPreviewDialog } from '../../components/play/PreviewDialogs';

const sortOptions = [
  { id: 0, name: '按 名称 排序 ↓' },
  { id: 1, name: '按 名称 排序 ↑' },
  { id: 2, name: '按 类型 排序 ↓' },
  { id: 3, name: '按 类型 排序 ↑' },
  { id: 4, name: '按 日期 排序 ↓' },
  { id: 5, name: '按 日期 排序 ↑' },
  { id: 6, name: '按 字数 排序 ↓' },
  { id: 7, name: '按 字数 排序 ↑' },
];

function sortList(list, sortType) {
  return [...list].sort((a, b) => {
    if (!a.plot || !b.plot) {
      return 0;
    }
    let value1;
    let value2;
    if (sortType === 0) {
      value1 = b.plot.title;
      value2 = a.plot.title;
    }
    if (sortType === 1) {
      value1 = a.plot.title;
      value2 = b.plot.title;
    }
    if (sortType === 2) {
      value1 = a.plot.type;
      value2 = b.plot.type;
    }
    if (sortType === 3) {
      value1 = b.plot.type;
      value2 = a.plot.type;
    }
    if (sortType === 4) {
      value1 = a.plot.updateTime;
      value2 = b.plot.updateTime;
    }
    if (sortType === 5) {
      value1 = b.plot.updateTime;
      value2 = a.plot.updateTime;
    }
    if (sortType === 6) {
      value1 = a.plot.title.length + (a.plot.descript || '').length;
      value2 = b.plot.title.length + (b.plot.descript || '').length;
    }
    if (sortType === 7) {
      value2 = a.plot.title.length + (a.plot.descript || '').length;
      value1 = b.plot.title.length + (b.plot.descript || '').length;
    }
    return [0, 1].includes(sortType) ? value2.localeCompare(value1, 'zh') : value2 - value1;
  });
}

export function PlayHistoryPage() {
  const navigate = useNavigate();
  const [gameList, setGameList] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [sortType, setSortType] = useState(6);
  const [plotPreview, setPlotPreview] = useState(null);
  const [characterPreview, setCharacterPreview] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const result = await API.PLAT_QUERY_HISTORY();
      if (!mounted) {
        return;
      }
      setGameList((result.gameList || []).map((item) => ({
        ...item,
        character: item.character ? { ...JSON.parse(item.character.info || '{}'), ...item.character } : null,
      })));
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredGames = useMemo(() => {
    const lowerSearch = searchValue.toLowerCase();
    const filtered = gameList.filter((item) => {
      if (!item.plot) {
        return false;
      }
      if (!lowerSearch) {
        return true;
      }
      const matchPlot = item.plot.title.toLowerCase().includes(lowerSearch) || (item.plot.descript && item.plot.descript.toLowerCase().includes(lowerSearch));
      const matchCharacter = item.character?.name?.toLowerCase().includes(lowerSearch);
      return matchPlot || matchCharacter;
    });
    return sortList(filtered, sortType);
  }, [gameList, searchValue, sortType]);

  return (
    <>
      <div className="main-container" style={{ background: `url(${images.bg_entry})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
        <img alt="logo" src={images.logo} className="login-logo" />
        <div className="mainpage-container" style={{ backgroundColor: 'rgba(71, 76 ,70, 0.7)', backgroundImage: 'none', width: '106.7rem', height: '60.8rem' }}>
          <div className="normal-row">
            <div className="row">
              <img alt="back" src={images.icon_back} onClick={() => navigate(-1)} />
              <span style={{ fontSize: '1.45rem' }}>入梦 - 历史记录</span>
            </div>
            <div className="row">
              <img alt="setting" src={images.setting} title="设置" />
              <img alt="help" src={images.question} title="产品帮助" />
            </div>
          </div>
          <div className="tablelist" style={{ width: '101.75rem', height: '52.75rem', marginTop: '3rem' }}>
            <div className="normal-row" style={{ padding: '2rem' }}>
              <img alt="time" src={images.icon_time} style={{ width: '6rem', height: '6rem' }} />
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                <SortSelect options={sortOptions} value={sortType} onChange={setSortType} style={{ marginRight: '3rem' }} />
                <Input className="search-input" placeholder="搜索" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} prefix={<img alt="search" src={images.icon_search} style={{ width: '1rem', height: '1rem' }} />} />
                <img alt="history-text" src={images.history_text} style={{ width: '5.6rem', height: '2.8rem', marginLeft: '2rem', marginRight: '2rem' }} />
              </div>
            </div>
            <div className="outlook-item-list" style={{ overflow: 'auto' }}>
              {filteredGames.map((item) => (
                <div key={item.gameId} onClick={() => navigate(`/play/main/${item.gameId}`)}>
                  <DreamSelectionCard
                    outlookInfo={item.plot}
                    characterInfo={item.character || { name: '无默认角色', background: '', worldType: '', uuid: '' }}
                    onSelect={() => navigate(`/play/main/${item.gameId}`)}
                    onCheckPlot={setPlotPreview}
                    onCheckCharacter={() => setCharacterPreview(item.character)}
                  />
                </div>
              ))}
            </div>
          </div>
          <img alt="grey-logo" src={images.grey_logo} style={{ marginTop: '2rem' }} />
        </div>
        <img alt="eng-logo" src={images.eng_logo} className="login-eng-logo" />
      </div>
      <PlotPreviewDialog plot={plotPreview} onClose={() => setPlotPreview(null)} />
      <CharacterPreviewDialog character={characterPreview} onClose={() => setCharacterPreview(null)} />
    </>
  );
}
