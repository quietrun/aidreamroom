import { images } from '../../constant';

export function LeftChatMessage({ message, mobile = false }) {
  return (
    <div className="leftMessage">
      <div style={{ width: mobile ? '1.375rem' : '2.2rem', display: 'flex', justifyContent: 'center', flexDirection: 'row', alignItems: 'center', flexShrink: 0, background: 'rgb(0,219,42)', borderRadius: mobile ? '1.375rem' : '2.2rem', marginLeft: mobile ? '0.313rem' : '0.3rem' }}>
        <img src={images.ava_aidr} style={{ width: mobile ? '1.375rem' : '2.2rem', height: mobile ? '1.375rem' : '2.2rem', alignSelf: 'flex-start' }} />
      </div>
      <div className="messageBox">
        <span style={{ fontSize: mobile ? '0.531rem' : '0.85rem', textAlign: 'left' }}>艾达 AIDR</span>
        <span style={{ fontSize: mobile ? '0.469rem' : '0.75rem', textAlign: 'left' }}>{message}</span>
      </div>
    </div>
  );
}

export function RightChatMessage({ message, characterName, image, mobile = false }) {
  return (
    <div className="leftMessage" style={{ alignSelf: 'flex-end', marginRight: mobile ? '0.563rem' : undefined }}>
      <div className="messageBox" style={{ alignSelf: 'flex-end' }}>
        <span style={{ fontSize: mobile ? '0.531rem' : '0.85rem', textAlign: 'right', width: '100%' }}>{characterName}</span>
        <span style={{ fontSize: mobile ? '0.469rem' : '0.75rem', textAlign: 'left', width: '100%' }}>{message}</span>
      </div>
      <div style={{ width: mobile ? '1.375rem' : '2.2rem', display: 'flex', justifyContent: 'center', flexDirection: 'row', alignItems: 'center', flexShrink: 0, background: 'rgb(0,219,42)', borderRadius: mobile ? '1.375rem' : '2.2rem', marginRight: mobile ? '0.313rem' : '0.3rem' }}>
        <img src={image || images.icon_character_avater} style={{ width: mobile ? '1.375rem' : '2.2rem', height: mobile ? '1.375rem' : '2.2rem', alignSelf: 'flex-start', borderRadius: mobile ? '1.375rem' : '2.2rem' }} />
      </div>
    </div>
  );
}

export function LeftImageMessage({ image, onShowImage }) {
  return (
    <div className="leftMessage">
      <div style={{ width: '2.2rem', display: 'flex', justifyContent: 'center', flexDirection: 'row', alignItems: 'center', flexShrink: 0, background: 'rgb(0,219,42)', borderRadius: '2.2rem', marginLeft: '0.3rem' }}>
        <img src={images.ava_aidr} style={{ width: '2.2rem', height: '2.2rem', alignSelf: 'flex-start' }} />
      </div>
      <div className="messageBox">
        <span style={{ fontSize: '0.85rem', textAlign: 'left' }}>艾达 AIDR</span>
        <img src={image} onClick={() => onShowImage(image)} style={{ maxWidth: '20rem', maxHeight: '20rem', alignSelf: 'flex-start', marginTop: '0.5rem', marginBottom: '0.5rem', marginRight: '0.5rem', borderRadius: '1rem' }} />
      </div>
    </div>
  );
}

export function ImageLightbox({ image, onClose }) {
  if (!image) {
    return null;
  }
  return (
    <div onClick={onClose} style={{ backgroundColor: 'rgba(0,0,0,0.5)', position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src={image} style={{ maxWidth: '90vw', maxHeight: '90vh' }} />
    </div>
  );
}
