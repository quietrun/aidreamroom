import { useEffect } from 'react';
import { helpDialogConfig } from '../../constant';

export function HelpDialog({ id, onClose }) {
  useEffect(() => {
    if (helpDialogConfig[id]) {
      helpDialogConfig[id].flag = false;
    }
  }, [id]);

  return (
    <div
      onClick={onClose}
      style={{
        backgroundColor: 'rgba(0,0,0,0.5)',
        position: 'absolute',
        width: '100vw',
        height: '100vh',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        alt={id}
        src={helpDialogConfig[id]?.image}
        style={{ maxWidth: '90vw', maxHeight: '90vh' }}
      />
    </div>
  );
}
