import { QR } from '@/core/lib/qr';
import '@/core/theme/membership-card.css';
import { Text } from '@/features/card/Card.model';
import { Close } from '@/features/card/components/Close';
import { useEffect, useRef } from 'react';
export function QrDialog({
  value,
  pending,
  name,
  code,
  onRetry,
  onClose,
  t,
}: {
  value?: string | null;
  pending: boolean;
  name: string;
  code: string;
  onRetry: () => void;
  onClose: () => void;
  t: Text;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="mp-dialog mp-qr-dialog"
      aria-labelledby="qr-title"
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="mp-dialog-header">
        <h2 id="qr-title">{t('Membership verification', 'உறுப்பினர் சரிபார்ப்பு')}</h2>
        <Close t={t} onClose={onClose} />
      </div>
      <div className="mp-qr-content">
        {value ? (
          <div className="mp-qr-paper">
            <QR value={value} size={240} margin={4} />
          </div>
        ) : (
          <p role="status">
            {pending
              ? t('Preparing your code…', 'குறியீடு தயாராகிறது…')
              : t(
                  'Check-in code unavailable right now. Try again shortly.',
                  'வருகைப் பதிவுக் குறியீடு தற்போது கிடைக்கவில்லை. விரைவில் மீண்டும் முயற்சிக்கவும்.',
                )}
          </p>
        )}
        <strong>{name}</strong>
        <span>{code}</span>
        {value ? (
          <p>{t('Show this QR to check in', 'வருகைப் பதிவுக்கு இந்த QR ஐக் காட்டுங்கள்')}</p>
        ) : (
          <button className="mp-action" type="button" onClick={onRetry}>
            {t('Try again', 'மீண்டும் முயற்சி')}
          </button>
        )}
      </div>
    </dialog>
  );
}
