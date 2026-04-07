import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/index.scss';
import { images } from '../../../constant';
import { quickStartConfig, setQuickStartConfig } from '../../../function/quickStart';
import { API } from '../../../utils/API';

export function MobilePlaySelectPage() {
  const navigate = useNavigate();
  const [modelList, setModelList] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const { moduleList } = await API.PLAY_QUERY_MODULE_LIST();
      if (mounted) {
        setModelList(moduleList || []);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const goPlay = async (selectedModuleId) => {
    let plotId = '';
    let characterId = '';
    if (quickStartConfig) {
      plotId = quickStartConfig.plot_id;
      characterId = quickStartConfig.character_id;
      setQuickStartConfig(null);
    }
    const { info } = await API.PLAY_CREATE({ plot_id: plotId, character_id: characterId, model_id: selectedModuleId });
    navigate(`/mobile/play/main/${info.uuid}`, { replace: true });
  };

  return (
    <div className="mobile-app">
      <div className="main-container">
      <div className="mainpage-container">
        <div className="normal-row" style={{ marginTop: '0.719rem' }}>
          <span style={{ marginLeft: '0.844rem', fontSize: '0.719rem' }}>AI Dreamroom Beta 0.9.2</span>
          <div className="row">
            <img src={images.question} onClick={() => window.open('https://www.bilibili.com/video/BV1WF4m1L72W/')} style={{ marginLeft: '0.5rem', marginRight: '0.688rem' }} />
          </div>
        </div>
        <div style={{ background: '#333333', borderRadius: '0.577rem', margin: 'auto', width: '15.25rem', height: '25.813rem', padding: '0rem' }}>
          <div style={{ marginTop: '2rem', marginBottom: '0.969rem', border: '0.068rem', borderRadius: '0.577rem', opacity: '0.84', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ color: '#FFF', fontSize: '1rem' }}>请选择 叙述者</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', marginTop: '2.156rem' }}>
            {modelList.map((item) => (
              <div key={item.moduleId} style={{ marginBottom: '0.969rem', border: '0.068rem', borderRadius: '0.577rem', opacity: '0.84', marginLeft: '4.5rem', marginRight: '4.5rem', width: '6.25rem', height: '2.125rem', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', background: 'rgb(77,79,76)', color: '#fff' }} onClick={() => goPlay(item.moduleId)}>
                <span style={{ color: '#FFF', fontSize: '0.7rem' }}>{item.showName}</span>
              </div>
            ))}
            <div style={{ marginBottom: '0.969rem', border: '0.068rem', borderRadius: '0.577rem', opacity: '0.84', marginLeft: '4.5rem', marginRight: '4.5rem', width: '6.25rem', height: '2.125rem', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', background: 'rgb(77,79,76,0.6)', color: '#fff' }}>
              <span style={{ color: '#666', fontSize: '0.7rem' }}>敬请期待</span>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

