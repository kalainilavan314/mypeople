import '@/core/theme/membership-card.css';
import { Text } from '@/features/card/Card.model';
import { Close } from '@/features/card/components/Close';
import { type MembershipCredentialData } from '@/features/card/components/MembershipCredential';
import { useEffect, useRef, useState } from 'react';
export function ShareDialog({
  data,
  onClose,
  t,
}: {
  data: MembershipCredentialData;
  onClose: () => void;
  t: Text;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [message, setMessage] = useState('');
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const share = async () => {
    try {
      const text = ['My People', data.name, data.memberId, data.verificationLabel].join('\n');
      if (navigator.share) await navigator.share({ title: 'My People', text });
      else {
        await navigator.clipboard.writeText(text);
        setMessage(t('Copied', 'நகலெடுக்கப்பட்டது'));
      }
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError'))
        setMessage(
          t('Could not share. Please try again.', 'பகிர முடியவில்லை. மீண்டும் முயற்சிக்கவும்.'),
        );
    }
  };
  return (
    <dialog
      ref={ref}
      className="mp-dialog mp-qr-dialog"
      aria-labelledby="share-title"
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="mp-dialog-header">
        <h2 id="share-title">{t('Share preview', 'பகிர்வதற்கு முன்')}</h2>
        <Close t={t} onClose={onClose} />
      </div>
      <p>
        {data.name}
        <br />
        {data.memberId}
        <br />
        {data.verificationLabel}
      </p>
      <p>
        {t(
          'Only your name, member ID and identity status will be shared. Your private QR and portrait are excluded.',
          'உங்கள் பெயர், உறுப்பினர் எண் மற்றும் அடையாள நிலை மட்டுமே பகிரப்படும். தனிப்பட்ட QR மற்றும் புகைப்படம் பகிரப்படாது.',
        )}
      </p>
      <button className="mp-share-submit" type="button" onClick={() => void share()}>
        {t('Share', 'பகிர்')}
      </button>
      <p role="status">{message}</p>
    </dialog>
  );
}
