import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../../utils/API';
import { images, WORLD_TYPE } from '../../constant';

export function CharacterSelectDialog({ selectedCharacter, onSelect, onClose }) {
  const navigate = useNavigate();
  const [characterList, setCharacterList] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const result = await API.CHARACTER_LIST();
      if (!mounted) {
        return;
      }
      setCharacterList(result.list.map((item) => ({ ...item, info: JSON.parse(item.info) })));
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="mainpage-container" style={{ background: 'none', border: 'none', zIndex: '1000' }}>
      <div className="outlook-create" style={{ backgroundImage: `url(${images.icon_glass})`, backgroundPosition: 'right bottom', backgroundSize: '8rem 8rem', backgroundRepeat: 'no-repeat', marginLeft: '15rem' }}>
        <div className="title">
          <div className="left-cell">
            <img src={images.icon_dialog_close} onClick={onClose} />
          </div>
          <span>选择游玩角色</span>
          <div className="right-cell">
            <img src={images.icon_cycle_add} onClick={() => navigate('/character')} />
          </div>
        </div>
        <div style={{ width: '100%', display: 'flex', flex: 1, flexDirection: 'column', overflow: 'auto', marginTop: '1rem' }}>
          {characterList.map((item) => (
            <div key={item.uuid} style={{ width: '100%' }} onClick={() => onSelect(item)}>
              <div className="item-cell" style={{ cursor: 'pointer', padding: '0.5rem 0rem' }}>
                <div style={{ display: 'flex', flexDirection: 'row', marginLeft: '1rem', justifyContent: 'flex-start', alignItems: 'center' }}>
                  <img src={item.image || images.icon_character_avater} style={{ width: '3rem', height: '3rem', borderRadius: '3rem' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: '#fff', fontSize: '0.85rem', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', width: '16rem', whiteSpace: 'nowrap' }}>{item.info.name}</span>
                    <span style={{ fontSize: '0.65rem', color: 'rgb(199,199,195)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '14rem' }}>{item.info.background}</span>
                    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', width: '100%', marginTop: '0.3rem' }}>
                      {(item.worldType?.split(',').map((type) => Number(type)) || []).map((type) => (
                        <div key={`${item.uuid}-${type}`} style={{ color: '#fff', borderRadius: '1rem', padding: '0.1rem 0.5rem', marginRight: '0.2rem', background: WORLD_TYPE[type]?.color, fontSize: '0.6rem' }}>
                          {WORLD_TYPE[type]?.text}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {selectedCharacter?.uuid === item.uuid && <img src={images.icon_dream_selecter} style={{ width: '1.3rem', height: '1.3rem' }} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
