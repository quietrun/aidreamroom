import { images, WORLD_TYPE } from '../../constant';

function renderTags(worldType, fontSize = '0.6rem') {
  return (worldType ? worldType.split(',') : []).map((item) => (
    <div key={`${worldType}-${item}`} style={{ color: '#fff', borderRadius: '1rem', padding: '0.1rem 0.5rem', marginLeft: '0.3rem', background: WORLD_TYPE[item]?.color, fontSize }}>
      {WORLD_TYPE[item]?.text}
    </div>
  ));
}

export function DreamSelectionCard({ outlookInfo, characterInfo, selected, onSelect, onCheckPlot, onCheckCharacter }) {
  return (
    <div style={{ marginLeft: '2rem', marginRight: '2rem', marginBottom: '2rem', marginTop: '2rem' }} onClick={() => onSelect(outlookInfo.uuid)}>
      <div className="chacater" onClick={(event) => { event.stopPropagation(); onCheckCharacter(characterInfo); }}>
        <div className="item-cell" style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', flexDirection: 'row', position: 'relative', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '-1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
              <img src={characterInfo.image || images.icon_character_avater} style={{ width: '3.55rem', height: '3.55rem', marginLeft: '-1rem', borderRadius: '3.5rem' }} />
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginLeft: '0.4rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', width: '7rem', marginTop: '1.2rem' }}>
                  <span style={{ color: '#fff', fontSize: '0.85rem', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', width: '8rem', whiteSpace: 'nowrap', marginTop: '0.5rem' }}>{characterInfo.name}</span>
                  <span style={{ fontSize: '0.65rem', color: 'rgb(199,199,195)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '8rem', marginTop: '0.3rem' }}>{characterInfo.background}</span>
                  <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', width: '100%', marginTop: '0.3rem' }}>
                    {renderTags(characterInfo.worldType, '0.6rem')}
                  </div>
                </div>
              </div>
            </div>
            <img src={images.icon_dream_selecter} style={{ width: '2.6rem', height: '2.6rem', opacity: selected ? 1 : 0, marginRight: '-1rem' }} />
          </div>
        </div>
      </div>
      <div className="outlook-item" style={{ height: '15.2rem', marginLeft: 0, marginTop: '2rem' }}>
        <div className="normal-row" style={{ alignItems: 'flex-end' }}>
          <img src={images.icon_like} style={{ cursor: 'pointer' }} />
          <img src={images.icon_cycle_right} onClick={(event) => { event.stopPropagation(); onCheckPlot(outlookInfo); }} />
        </div>
        <span style={{ marginTop: '0.91rem', fontSize: '0.6rem' }}>{outlookInfo.title || JSON.parse(outlookInfo.info).name}</span>
        <span className="outlook-item-detail" style={{ height: '3.1rem', fontSize: '0.6rem', color: 'rgb(199,199,195)', textAlign: 'left' }}>
          {outlookInfo.info ? JSON.parse(outlookInfo.info).background : outlookInfo.descript}
        </span>
        <img style={{ width: '11.95rem', height: '6.75rem', borderRadius: '0.5rem', marginTop: '0.7rem' }} src={outlookInfo.images || images.background3} />
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', width: '100%', marginTop: '0.4rem' }}>
          {renderTags(outlookInfo.worldType, '0.6rem')}
        </div>
      </div>
    </div>
  );
}
