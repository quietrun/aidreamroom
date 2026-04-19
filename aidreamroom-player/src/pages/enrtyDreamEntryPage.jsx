import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/index.scss';
import { API } from '../utils/API';
import { images } from '../constant';

export function EntryDreamPage() {
  const navigate = useNavigate();
  const [characterName, setCharacterName] = useState('');
  const [plotName, setPlotName] = useState('');
  const [latestGame, setLatestGame] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const result = await API.PLAT_LATEST_GAME();
      if (!mounted) {
        return;
      }
      const { plot, character, game } = result;
      setCharacterName(JSON.parse(character?.info || '{}')?.name || '');
      setPlotName(plot?.title || '');
      setLatestGame(game);
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="main-container" style={{ background: `url(${images.bg_entry})`, backgroundPosition: 'center center', backgroundSize: 'cover' }}>
      <img alt="logo" src={images.logo} className="login-logo" />
      <div className="mainpage-container" style={{ backgroundColor: 'rgba(70,55,38, 0.7)', backgroundImage: 'none', width: '63.5rem' }}>
        <div className="normal-row">
          <div className="row">
            <img alt="back" src={images.icon_back} onClick={() => navigate(-1)} title="返回" />
            <span style={{ fontSize: '1.45rem' }}>入梦 - 即刻开始 欢迎加入交流QQ群 271523919</span>
          </div>
          <div className="row">
            <img alt="setting" src={images.setting} title="设置" />
            <img alt="help" src={images.question} title="产品帮助" />
          </div>
        </div>
        <div className="normal-row" style={{ justifyContent: 'center', flexDirection: 'column' }}>
          <div className="button-group-create" style={{ background: `url(${images.btn_entry_continue})`, backgroundSize: 'contain', width: '60.75rem', height: '13.75rem', marginRight: 0 }} onClick={() => latestGame && navigate(`/play/main/${latestGame.uuid}`)}>
            <div style={{ marginBottom: '2rem', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', width: '100%', display: 'flex' }}>
              <div className="info-text" style={{ width: '10rem', marginLeft: '2rem' }}>
                <span>{characterName}</span>
              </div>
              <div className="info-text" style={{ width: '10rem', marginLeft: '2rem' }}>
                <span>{plotName}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', width: '60.75rem', alignItems: 'flex-start', justifyContent: 'flex-start' }}>
            <div className="button-group-create" onClick={() => navigate('/play/select')} style={{ background: `url(${images.btn_entry_new})`, backgroundSize: 'contain', width: '36.7rem', height: '13.75rem', marginRight: 0 }}>
              <div style={{ marginBottom: '2rem', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', width: '100%', display: 'flex' }}>
                <div className="info-text" style={{ width: '16rem', marginRight: '1rem' }}>
                  <span>入梦 - 开始一段新的梦境</span>
                  <img alt="entry" src={images.entry_cycle} />
                </div>
              </div>
            </div>
            <div className="button-group-create" onClick={() => navigate('/play/history')} style={{ background: `url(${images.btn_entry_history})`, backgroundSize: 'contain', width: '22.25rem', height: '13.75rem', marginRight: 0, marginLeft: '2rem' }}>
              <div style={{ marginBottom: '2rem', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', width: '100%', display: 'flex' }}>
                <div className="info-text" style={{ width: '9rem', marginRight: '1rem' }}>
                  <span>查看过往旅程</span>
                  <img alt="entry" src={images.entry_cycle} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <img alt="grey-logo" src={images.grey_logo} style={{ marginTop: '2rem' }} />
      </div>
      <img alt="eng-logo" src={images.eng_logo} className="login-eng-logo" />
    </div>
  );
}
