import { images, WORLD_TYPE } from '../../constant';

function BadgeList({ worldType }) {
  return (worldType ? worldType.split(',') : []).map((item) => (
    <div key={`${worldType}-${item}`} style={{ color: '#fff', borderRadius: '1rem', padding: '0.1rem 0.5rem', marginLeft: '0.3rem', background: WORLD_TYPE[item]?.color, fontSize: '0.8rem' }}>
      {WORLD_TYPE[item]?.text}
    </div>
  ));
}

export function PlotPreviewDialog({ plot, onClose }) {
  if (!plot) {
    return null;
  }
  return (
    <div onClick={onClose} style={{ backgroundColor: 'rgba(0,0,0,0.6)', position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="outlook-item" style={{ width: '28rem', height: 'auto', marginLeft: 0, padding: '1.5rem' }} onClick={(event) => event.stopPropagation()}>
        <div className="normal-row">
          <span style={{ fontSize: '1.2rem' }}>{plot.title}</span>
          <img src={images.icon_dialog_close} onClick={onClose} />
        </div>
        <span className="outlook-item-detail" style={{ fontSize: '0.85rem', textAlign: 'left', marginTop: '1rem', minHeight: '4rem' }}>{plot.descript}</span>
        <img src={plot.images || images.background3} style={{ width: '100%', height: '14rem', objectFit: 'cover', borderRadius: '1rem', marginTop: '1rem' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '1rem' }}>
          <BadgeList worldType={plot.worldType} />
        </div>
      </div>
    </div>
  );
}

export function CharacterPreviewDialog({ character, onClose }) {
  if (!character) {
    return null;
  }
  const info = character.info ? (typeof character.info === 'string' ? JSON.parse(character.info) : character.info) : character;
  return (
    <div onClick={onClose} style={{ backgroundColor: 'rgba(0,0,0,0.6)', position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="outlook-item" style={{ width: '26rem', height: 'auto', marginLeft: 0, padding: '1.5rem' }} onClick={(event) => event.stopPropagation()}>
        <div className="normal-row">
          <span style={{ fontSize: '1.2rem' }}>{info.name || '角色详情'}</span>
          <img src={images.icon_dialog_close} onClick={onClose} />
        </div>
        <img src={character.image || images.icon_character_avater} style={{ width: '6rem', height: '6rem', borderRadius: '6rem', objectFit: 'cover', marginTop: '1rem' }} />
        <span className="outlook-item-detail" style={{ fontSize: '0.85rem', textAlign: 'left', marginTop: '1rem', minHeight: '4rem' }}>{info.background}</span>
        <div style={{ display: 'flex', justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: '1rem' }}>
          <BadgeList worldType={character.worldType} />
        </div>
      </div>
    </div>
  );
}
