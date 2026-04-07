import { useEffect, useMemo, useState } from 'react';
import { Input, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import '../../styles/index.scss';
import { API } from '../../utils/API';
import { quickStartConfig, setQuickStartConfig } from '../../function/quickStart';
import { helpDialogConfig, images, WORLD_TYPE, firstLogin } from '../../constant';
import { SortSelect } from '../../components/play/SortSelect';
import { DreamSelectionCard } from '../../components/play/DreamSelectionCard';
import { CharacterSelectDialog } from '../../components/play/CharacterSelectDialog';
import { CharacterPreviewDialog, PlotPreviewDialog } from '../../components/play/PreviewDialogs';
import { HelpDialog } from '../../components/common/HelpDialog';

const defaultCharacter = {
  name: '无默认角色',
  background: '',
  worldType: '',
  uuid: '',
};

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
    let value1;
    let value2;
    if (sortType === 0) {
      value1 = b.title;
      value2 = a.title;
    }
    if (sortType === 1) {
      value1 = a.title;
      value2 = b.title;
    }
    if (sortType === 2) {
      value1 = a.type;
      value2 = b.type;
    }
    if (sortType === 3) {
      value1 = b.type;
      value2 = a.type;
    }
    if (sortType === 4) {
      value1 = a.updateTime;
      value2 = b.updateTime;
    }
    if (sortType === 5) {
      value1 = b.updateTime;
      value2 = a.updateTime;
    }
    if (sortType === 6) {
      value1 = a.title.length + (a.descript || '').length;
      value2 = b.title.length + (b.descript || '').length;
    }
    if (sortType === 7) {
      value2 = a.title.length + (a.descript || '').length;
      value1 = b.title.length + (b.descript || '').length;
    }
    return [0, 1].includes(sortType) ? value2.localeCompare(value1, 'zh') : value2 - value1;
  });
}

export function PlaySelectPage() {
  const navigate = useNavigate();
  const [rawPlotList, setRawPlotList] = useState([]);
  const [characterMap, setCharacterMap] = useState({});
  const [showSelect, setShowSelect] = useState(true);
  const [selectedModuleId, setSelectedModuleId] = useState(1);
  const [selectedPlot, setSelectedPlot] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState(defaultCharacter);
  const [selectedPlotInfo, setSelectedPlotInfo] = useState({});
  const [showCharacterDialog, setShowCharacterDialog] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [sortType, setSortType] = useState(6);
  const [modelList, setModelList] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  const [plotPreview, setPlotPreview] = useState(null);
  const [characterPreview, setCharacterPreview] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { moduleList } = await API.PLAY_QUERY_MODULE_LIST();
      const [character, plot] = await Promise.all([API.CHARACTER_LIST_ALL(), API.PLOT_LIST_ALL()]);
      if (!mounted) {
        return;
      }
      setModelList(moduleList);
      const nextCharacterMap = {};
      character.list.forEach((item) => {
        const info = JSON.parse(item.info);
        nextCharacterMap[item.uuid] = {
          name: info.name,
          background: info.background,
          worldType: item.worldType,
          uuid: item.uuid,
          image: item.image,
          origin: { ...item, info },
        };
      });
      setCharacterMap(nextCharacterMap);
      setRawPlotList(plot.list || []);
      if (quickStartConfig) {
        setShowSelect(false);
        const selectedPlotInfo_ = (plot.list || []).find((item) => item.uuid === quickStartConfig.plot_id) || {};
        setSelectedPlot(quickStartConfig.plot_id);
        setSelectedPlotInfo(selectedPlotInfo_);
        setSelectedCharacter({ ...nextCharacterMap[quickStartConfig.character_id] });
        setQuickStartConfig(null);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredPlotList = useMemo(() => {
    const lowerSearch = searchValue.toLowerCase();
    const filtered = rawPlotList.filter((item) => {
      if (!lowerSearch) {
        return true;
      }
      const character = item.bindCharacter ? characterMap[item.bindCharacter] || defaultCharacter : defaultCharacter;
      const matchPlot = item.title.toLowerCase().includes(lowerSearch) || (item.descript && item.descript.toLowerCase().includes(lowerSearch));
      const matchCharacter = (character.name || '').toLowerCase().includes(lowerSearch);
      return matchPlot || matchCharacter;
    });
    return sortList(filtered, sortType);
  }, [rawPlotList, searchValue, sortType, characterMap]);

  const changeSelect = (id) => {
    setSelectedPlot(id);
    const currentPlot = rawPlotList.find((item) => item.uuid === id) || {};
    setSelectedPlotInfo(currentPlot);
    setSelectedCharacter(characterMap[currentPlot.bindCharacter] || defaultCharacter);
  };

  const goVerify = () => {
    if (!selectedPlot) {
      message.info('请选择您要游玩的内容');
      return;
    }
    setShowHelp(firstLogin && helpDialogConfig.help_play_change_character.flag);
    setShowSelect(false);
  };

  const goPlay = async () => {
    if (!selectedCharacter.uuid) {
      message.info('请选择您要扮演的角色');
      return;
    }
    const { info } = await API.PLAY_CREATE({ plot_id: selectedPlotInfo.uuid, character_id: selectedCharacter.uuid, model_id: selectedModuleId });
    navigate(`/play/main/${info.uuid}`, { replace: true });
  };

  return (
    <>
      <div className="main-container" style={{ background: `url(${images.background3})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
        <img alt="logo" src={images.logo} className="login-logo" />
        {showSelect ? (
          <div className="mainpage-container" style={{ backgroundColor: 'rgba(71, 76 ,70, 0.7)', backgroundImage: 'none', width: '106.7rem', height: '60.8rem', zoom: '90%' }}>
            <div className="normal-row">
              <div className="row">
                <img alt="back" src={images.icon_back} onClick={() => navigate(-1)} title="返回" />
                <span style={{ fontSize: '1.45rem' }}>配梦 - 在游玩库中选择新的旅程</span>
              </div>
              <div className="row">
                <img alt="setting" src={images.setting} title="设置" />
                <img alt="question" src={images.question} title="产品帮助" />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <div className="tablelist" style={{ width: '101.75rem', height: '52.75rem', marginTop: '3rem' }}>
                <div className="normal-row" style={{ padding: '2rem' }}>
                  <img alt="planet" src={images.icon_planet} style={{ width: '5.85rem', height: '6.05rem' }} />
                  <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                    <SortSelect options={sortOptions} value={sortType} onChange={setSortType} style={{ marginRight: '3rem' }} />
                    <Input className="search-input" placeholder="搜索" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} prefix={<img alt="search" src={images.icon_search} style={{ width: '1rem', height: '1rem' }} />} />
                    <img alt="outlook-text" src={images.outlook_text} style={{ width: '8.4rem', height: '2.8rem', marginLeft: '2rem', marginRight: '2rem' }} />
                  </div>
                </div>
                <div className="outlook-item-list" style={{ overflow: 'auto' }}>
                  {filteredPlotList.map((item) => (
                    <DreamSelectionCard
                      key={item.uuid}
                      outlookInfo={item}
                      characterInfo={item.bindCharacter ? characterMap[item.bindCharacter] || defaultCharacter : defaultCharacter}
                      selected={selectedPlot === item.uuid}
                      onSelect={changeSelect}
                      onCheckPlot={setPlotPreview}
                      onCheckCharacter={(info) => {
                        const detail = characterMap[info.uuid]?.origin;
                        if (detail) {
                          setCharacterPreview(detail);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="save_btn" style={{ bottom: 'calc(38.5rem - 33.9rem - 1.7rem - 6rem)', position: 'relative' }} onClick={goVerify}>
              <div className="messageSendBar">
                <div className="buttonContainer" style={{ backgroundColor: 'rgba(1, 109, 29, 0.9)' }}>
                  <div style={{ marginRight: '0.5rem' }}>
                    <img alt="start" src={images.icon_start} />
                  </div>
                  <div className="buttonInfoContainer" style={{ backgroundColor: 'rgba(37, 129, 51, 0.9)' }}>
                    <span style={{ width: '5rem', textAlign: 'center' }}> 立即开始 </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mainpage-container" style={{ backgroundColor: 'rgba(71, 76 ,70, 0.7)', backgroundImage: 'none', height: '60.8rem', width: '39.45rem', zoom: '90%' }}>
            <div className="normal-row">
              <div className="row">
                <img alt="back" src={images.icon_back} onClick={() => setShowSelect(true)} title="返回" />
                <span style={{ fontSize: '1.45rem' }}>配梦 - 在游玩库中选择新的旅程</span>
              </div>
              <div className="row">
                <img alt="setting" src={images.setting} title="设置" />
                <img alt="question" src={images.question} title="产品帮助" onClick={() => setShowHelp(true)} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <div className="tablelist" style={{ width: '37.45rem', height: '52.75rem', marginTop: '3rem' }}>
                <div className="normal-row" style={{ padding: '1rem 2rem' }}>
                  <img alt="planet" src={images.icon_planet} style={{ width: '5.85rem', height: '6.05rem' }} />
                  <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                    <img alt="outlook-text" src={images.outlook_text} style={{ width: '8.4rem', height: '2.8rem', marginLeft: '2rem', marginRight: '2rem' }} />
                  </div>
                </div>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ width: '24rem', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', alignItems: 'center', color: 'rgb(255,255,255)', background: 'rgb(107,102,93)', marginBottom: '1rem', borderRadius: '1rem', paddingTop: '0.5rem' }}>
                    请选择 叙述者
                    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '90%', background: 'rgb(60,55,44)', height: '2.5rem', padding: '0rem 1rem', borderRadius: '1rem', marginTop: '0.5rem' }}>
                      {modelList.map((item) => (
                        <div key={item.moduleId} style={{ background: selectedModuleId === item.moduleId ? 'rgb(77,79,76)' : 'none', width: '100%', height: '90%', color: '#fff', alignItems: 'center', justifyContent: 'center', display: 'flex', borderRadius: '1rem', cursor: 'pointer' }} onClick={() => setSelectedModuleId(item.moduleId)}>
                          {item.showName}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="chacater1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', color: '#fff', borderRadius: '5rem', width: '23.25rem', padding: '1rem', marginBottom: '1.5rem', height: '6rem' }} onClick={() => setShowCharacterDialog(true)}>
                    <div className="item-cell" style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', flexDirection: 'row', marginLeft: '1rem', justifyContent: 'flex-start', alignItems: 'center' }}>
                        <img alt="character" src={selectedCharacter.image || images.icon_character_avater} style={{ width: '3.2rem', height: '3.2rem', borderRadius: '3.2rem' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '1rem', width: '13rem' }}>
                          <span style={{ color: '#fff', fontSize: '1.65rem', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', width: '12rem', whiteSpace: 'nowrap' }}>{selectedCharacter.name}</span>
                          <span style={{ fontSize: '1.26rem', color: 'rgb(199,199,195)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '12rem', marginTop: '0.3rem' }}>{selectedCharacter.background}</span>
                          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', width: '100%', marginTop: '0.3rem' }}>
                            {(selectedCharacter.worldType?.split(',').map((item) => Number(item)) || []).map((item) => (
                              <div key={`${selectedCharacter.uuid}-${item}`} style={{ color: '#fff', borderRadius: '1rem', padding: '0.1rem 0.5rem', marginRight: '0.2rem', background: WORLD_TYPE[item]?.color, fontSize: '1rem' }}>
                                {WORLD_TYPE[item]?.text}
                              </div>
                            ))}
                          </div>
                        </div>
                        <img alt="change-character" src={images.icon_plot_character_change} title="更换游玩角色" />
                      </div>
                    </div>
                  </div>
                  <div className="outlook-item" style={{ height: '27.5rem', width: '23.25rem', marginLeft: 0, padding: '1rem' }}>
                    <div className="normal-row" style={{ alignItems: 'flex-end' }}>
                      <img alt="like" src={images.icon_like} title="点赞" style={{ cursor: 'pointer', width: '2.6rem', height: '2.6rem' }} />
                      <img alt="detail" src={images.icon_cycle_right} title="查看详情" style={{ cursor: 'pointer', width: '2.6rem', height: '2.6rem' }} onClick={() => setPlotPreview(selectedPlotInfo)} />
                    </div>
                    <span style={{ marginTop: '0.91rem', fontSize: '1rem' }}>{selectedPlotInfo.title}</span>
                    <span className="outlook-item-detail" style={{ height: '5.1rem', fontSize: '0.9rem', color: 'rgb(199,199,195)', textAlign: 'left' }}>{selectedPlotInfo.descript}</span>
                    <img alt="cover" style={{ width: '23.25rem', height: '13.1rem', borderRadius: '0.5rem', marginTop: '0.7rem' }} src={selectedPlotInfo.images || images.background3} />
                    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', width: '100%', marginTop: '1rem' }}>
                      {(selectedPlotInfo.worldType ? selectedPlotInfo.worldType.split(',') : []).map((item) => (
                        <div key={`${selectedPlotInfo.uuid}-${item}`} style={{ color: '#fff', borderRadius: '1rem', padding: '0.1rem 0.5rem', marginLeft: '0.3rem', background: WORLD_TYPE[item]?.color, fontSize: '1rem' }}>{WORLD_TYPE[item]?.text}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {showCharacterDialog && <CharacterSelectDialog selectedCharacter={selectedCharacter} onClose={() => setShowCharacterDialog(false)} onSelect={(item) => { setSelectedCharacter({ name: item.info.name, background: item.info.background, worldType: item.worldType, uuid: item.uuid, image: item.image }); setShowCharacterDialog(false); }} />}
            <div className="save_btn" style={{ bottom: 'calc(38.5rem - 33.9rem - 1.7rem - 6rem)', position: 'relative' }} onClick={goPlay}>
              <div className="messageSendBar">
                <div className="buttonContainer" style={{ backgroundColor: 'rgba(1, 109, 29, 0.9)' }}>
                  <div style={{ marginRight: '0.5rem' }}>
                    <img alt="start" src={images.icon_start} />
                  </div>
                  <div className="buttonInfoContainer" style={{ backgroundColor: 'rgba(37, 129, 51, 0.9)' }}>
                    <span style={{ width: '5rem', textAlign: 'center' }}> 立即开始 </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        <img alt="eng-logo" src={images.eng_logo} className="login-eng-logo" />
      </div>
      {showHelp && <HelpDialog id="help_play_change_character" onClose={() => setShowHelp(false)} />}
      <PlotPreviewDialog plot={plotPreview} onClose={() => setPlotPreview(null)} />
      <CharacterPreviewDialog character={characterPreview} onClose={() => setCharacterPreview(null)} />
    </>
  );
}
